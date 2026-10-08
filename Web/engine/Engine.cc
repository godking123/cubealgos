// The engine behind the web front end, compiled to WebAssembly and run in a worker
//
// Each browser tab owns one session, the cube the page shows and its undo history.
// The page sends a command name and URL-encoded parameters and gets back the same
// JSON the old local HTTP simulator served, so nothing here reaches into the solvers
// beyond their public calls
#include "../../CubeState/CubeAlgos.h"
#include "../../Scramblers/WCA.h"
#include "../../Solvers/KociembaNaive/Kociemba.h"
#include "../../Solvers/CFOP/PieceSearch.h"
#include "../../Solvers/CFOP/Cross/Cross.h"
#include "../../Solvers/CFOP/F2L/F2L.h"
#include "../../Solvers/CFOP/OLL/OLL.h"
#include "../../Solvers/CFOP/PLL/PLL.h"
#include <emscripten/emscripten.h>
#include <cstring>
#include <map>
#include <sstream>

namespace {

struct Session {
    CubeState state = CubeState::solved();
    Orientation hold;
    std::vector<std::pair<CubeState, Orientation>> history;
};

// Slot facelets in Kociemba order, U/D sticker first then clockwise
const int CORNER_FACES[8][3] = {
    {0,1,2},{0,2,4},{0,4,5},{0,5,1},{3,2,1},{3,4,2},{3,5,4},{3,1,5}
};
const int EDGE_FACES[12][2] = {
    {0,1},{0,2},{0,4},{0,5},{3,1},{3,2},{3,4},{3,5},{2,1},{2,4},{5,4},{5,1}
};

std::string arr(const uint8_t* a, int n) {
    std::string s = "[";
    for (int i = 0; i < n; i++) s += (i ? "," : "") + std::to_string(a[i]);
    return s + "]";
}

std::string moves(const std::vector<Move>& m) {
    std::string s = "[";
    for (size_t i = 0; i < m.size(); i++) s += (i ? ",\"" : "\"") + std::string(moveName(m[i])) + "\"";
    return s + "]";
}

std::string quoted(const std::string& s) { return "\"" + s + "\""; }

// Piece sticker n sits on slot facelet (n + orientation) % k, colours from the hold
std::string snapshot(const Session& ss) {
    const CubeState& s = ss.state;
    std::ostringstream o;
    o << "{\"cp\":" << arr(s.cp, 8) << ",\"co\":" << arr(s.co, 8)
      << ",\"ep\":" << arr(s.ep, 12) << ",\"eo\":" << arr(s.eo, 12)
      << ",\"hold\":" << quoted(rotationsTo(ss.hold)) << ",\"faces\":[";
    for (int f = 0; f < 6; f++) o << (f ? "," : "") << ss.hold.faceAt(f);
    o << "],\"corners\":[";
    for (int slot = 0; slot < 8; slot++) {
        int piece = s.cp[slot], ori = s.co[slot];
        int col[3];
        for (int n = 0; n < 3; n++) col[(n + ori) % 3] = ss.hold.faceAt(CORNER_FACES[piece][n]);
        o << (slot ? "," : "") << "[" << col[0] << "," << col[1] << "," << col[2] << "]";
    }
    o << "],\"edges\":[";
    for (int slot = 0; slot < 12; slot++) {
        int piece = s.ep[slot], ori = s.eo[slot];
        int col[2];
        for (int n = 0; n < 2; n++) col[(n + ori) % 2] = ss.hold.faceAt(EDGE_FACES[piece][n]);
        o << (slot ? "," : "") << "[" << col[0] << "," << col[1] << "]";
    }
    o << "],\"solved\":" << (s.isSolved() ? "true" : "false")
      << ",\"cross\":" << (Cross::isSolved(s) ? "true" : "false") << ",\"pairs\":[";
    for (int k = 0; k < F2L::SLOTS; k++) {
        bool in = PieceSearch::isSolved(s, 1 << F2L::edge(k), 1 << F2L::corner(k));
        o << (k ? "," : "") << (in ? "true" : "false");
    }
    o << "],\"f2l\":" << (F2L::isSolved(s) ? "true" : "false")
      << ",\"oll\":" << (F2L::isSolved(s) && OLL::isSolved(s) ? "true" : "false")
      << ",\"history\":" << ss.history.size() << "}";
    return o.str();
}

std::string urlDecode(const std::string& s) {
    std::string out;
    for (size_t i = 0; i < s.size(); i++) {
        if (s[i] == '+') out += ' ';
        else if (s[i] == '%' && i + 2 < s.size()) { out += (char)strtol(s.substr(i + 1, 2).c_str(), nullptr, 16); i += 2; }
        else out += s[i];
    }
    return out;
}

std::map<std::string, std::string> query(const std::string& q) {
    std::map<std::string, std::string> m;
    std::istringstream ss(q);
    std::string kv;
    while (std::getline(ss, kv, '&')) {
        size_t eq = kv.find('=');
        if (eq != std::string::npos) m[kv.substr(0, eq)] = urlDecode(kv.substr(eq + 1));
    }
    return m;
}

bool parseRotation(const std::string& t, CubeRot& r) {
    for (int i = 0; i < 9; i++)
        if (t == rotationName(static_cast<CubeRot>(i))) { r = static_cast<CubeRot>(i); return true; }
    return false;
}

std::vector<uint8_t> ints(const std::string& s) {
    std::vector<uint8_t> v;
    std::istringstream ss(s);
    std::string t;
    while (std::getline(ss, t, ',')) v.push_back(std::stoi(t));
    return v;
}

bool isPermutation(const std::vector<uint8_t>& v, int n) {
    if ((int)v.size() != n) return false;
    std::vector<bool> seen(n);
    for (uint8_t x : v) { if (x >= n || seen[x]) return false; seen[x] = true; }
    return true;
}

int parity(const std::vector<uint8_t>& p) {
    int inv = 0;
    for (size_t i = 0; i < p.size(); i++) for (size_t j = i + 1; j < p.size(); j++) if (p[j] < p[i]) inv++;
    return inv % 2;
}

int placedMask(const CubeState& s) {
    int mask = 0;
    for (int k = 0; k < F2L::SLOTS; k++)
        if (PieceSearch::isSolved(s, 1 << F2L::edge(k), 1 << F2L::corner(k))) mask |= 1 << k;
    return mask;
}

// name is the case the step's alg solves, empty for a stage with no case table
std::string step(const std::string& label, const std::vector<Move>& m,
                 const std::string& name = "") {
    return "{\"label\":" + quoted(label) + ",\"case\":" + quoted(name) + ",\"moves\":" + moves(m) + "}";
}

// Every stage in the cross frame, so the page shows the rotation once and the moves
// as a solver holding the cube would make them
std::string cfop(const CubeState& start) {
    CrossResult cross = Cross::bestCross(start);
    CubeState s = start.rotate(cross.hold);
    auto run = [&](const std::vector<Move>& m) { for (Move x : m) s = s.apply(x); return m; };

    std::string out = "{\"rotation\":" + quoted(rotationsTo(cross.hold)) + ",\"steps\":[";
    out += step(std::string(colorName(cross.color)) + " cross", run(cross.moves));
    static const char* slotName[] = {"DFR", "DLF", "DBL", "DRB"};
    for (const F2LPair& p : F2L::solve(s))
        out += "," + step(std::string(slotName[p.slot]) + " pair", run(p.moves));
    std::string oll = OLL::caseName(s);
    out += "," + step("OLL", run(OLL::solve(s)), oll);
    std::string pll = PLL::caseName(s);
    out += "," + step("PLL", run(PLL::solve(s)), pll);
    return out + "]}";
}

CubeState scrambled(const std::string& scramble) {
    CubeState s = CubeState::solved();
    std::istringstream in(scramble);
    std::string tok;
    while (in >> tok) s = s.apply(parseMove(tok));
    return s;
}

// A timer solve looked at from its scramble alone, touching no session
//
// The cross on every colour shows what colour neutrality would have saved on this
// scramble. The CFOP solve is the engine's own path, so its OLL and PLL cases are a
// reference, not the cases the solver met after their own F2L
std::string analyze(const std::string& scramble) {
    CubeState s = scrambled(scramble);
    std::string out = "{\"crosses\":[";
    for (int c = 0; c < 6; c++) {
        Orientation o = orientationWithBottom(c);
        out += std::string(c ? "," : "") + "{\"color\":" + quoted(colorName(c))
             + ",\"rotation\":" + quoted(rotationsTo(o))
             + ",\"moves\":" + moves(Cross::solveCross(s.rotate(o))) + "}";
    }
    Session view;
    view.state = s;
    return out + "],\"cfop\":" + cfop(s) + ",\"state\":" + snapshot(view) + "}";
}

std::string handle(Session& ss, const std::string& cmd, std::map<std::string, std::string>& q) {
    auto snap = [&]() { return snapshot(ss); };
    auto err  = [](const std::string& m) { return "{\"error\":" + quoted(m) + "}"; };
    auto push = [&]() { ss.history.push_back({ss.state, ss.hold}); };

    if (cmd == "state") return snap();
    if (cmd == "reset") { push(); ss.state = CubeState::solved(); ss.hold = Orientation{}; return snap(); }
    if (cmd == "undo") {
        if (ss.history.empty()) return snap();
        ss.state = ss.history.back().first; ss.hold = ss.history.back().second; ss.history.pop_back();
        return snap();
    }
    // A scramble is applied to a solved cube in the standard hold, so the page can show
    // it as moves to make on a real cube
    if (cmd == "scramble") {
        push();
        ss.state = CubeState::solved(); ss.hold = Orientation{};
        std::vector<Move> sc = WCA::scramble();
        for (Move m : sc) ss.state = ss.state.apply(m);
        return "{\"moves\":" + moves(sc) + ",\"state\":" + snap() + "}";
    }
    // A scramble the page plays out move by move, so nothing is applied here
    if (cmd == "wca") return "{\"moves\":" + moves(WCA::scramble()) + "}";
    if (cmd == "apply") {
        std::istringstream in(q["seq"]);
        std::string tok;
        std::vector<std::string> steps;
        CubeState state = ss.state; Orientation hold = ss.hold;
        while (in >> tok) {
            CubeRot r;
            if (parseRotation(tok, r)) { state = state.rotate(r); hold = hold.then(r); }
            else { try { state = state.apply(parseMove(tok)); } catch (const std::exception&) { return err("Unknown token: " + tok); } }
            steps.push_back(tok);
        }
        push(); ss.state = state; ss.hold = hold;
        return snap();
    }
    if (cmd == "set") {
        auto cp = ints(q["cp"]), co = ints(q["co"]), ep = ints(q["ep"]), eo = ints(q["eo"]);
        if (!isPermutation(cp, 8) || !isPermutation(ep, 12)) return err("cp and ep must be permutations");
        if (co.size() != 8 || eo.size() != 12) return err("co needs 8 values, eo needs 12");
        int ts = 0, fs = 0;
        for (uint8_t x : co) { if (x > 2) return err("co values are 0 to 2"); ts += x; }
        for (uint8_t x : eo) { if (x > 1) return err("eo values are 0 or 1"); fs += x; }
        if (ts % 3) return err("Corner twists must sum to a multiple of 3");
        if (fs % 2) return err("Edge flips must sum to an even number");
        if (parity(cp) != parity(ep)) return err("Corner and edge permutation parity must match");
        push();
        for (int i = 0; i < 8;  i++) { ss.state.cp[i] = cp[i]; ss.state.co[i] = co[i]; }
        for (int i = 0; i < 12; i++) { ss.state.ep[i] = ep[i]; ss.state.eo[i] = eo[i]; }
        return snap();
    }
    if (cmd == "bestcross") {
        CrossResult r = Cross::bestCross(ss.state);
        return "{\"color\":" + quoted(colorName(r.color)) + ",\"rotation\":" + quoted(rotationsTo(r.hold))
             + ",\"moves\":" + moves(r.moves) + "}";
    }
    if (cmd == "cross") return "{\"moves\":" + moves(Cross::solveCross(ss.state)) + "}";
    if (cmd == "pair") {
        int slot = std::stoi(q["slot"]);
        if (slot < 0 || slot >= F2L::SLOTS) return err("slot is 0 to 3");
        if (!Cross::isSolved(ss.state)) return err("Solve the cross first");
        return "{\"moves\":" + moves(F2L::solvePair(ss.state, slot, placedMask(ss.state))) + "}";
    }
    if (cmd == "f2l") {
        if (!Cross::isSolved(ss.state)) return err("Solve the cross first");
        std::string out = "{\"pairs\":[";
        bool first = true;
        for (const F2LPair& p : F2L::solve(ss.state)) {
            out += (first ? "" : ",") + std::string("{\"slot\":") + std::to_string(p.slot) + ",\"moves\":" + moves(p.moves) + "}";
            first = false;
        }
        return out + "]}";
    }
    if (cmd == "oll") {
        if (!F2L::isSolved(ss.state)) return err("Solve F2L first");
        return "{\"case\":" + quoted(OLL::caseName(ss.state)) + ",\"moves\":" + moves(OLL::solve(ss.state)) + "}";
    }
    if (cmd == "pll") {
        if (!F2L::isSolved(ss.state)) return err("Solve F2L first");
        if (!OLL::isSolved(ss.state)) return err("Orient the last layer first");
        return "{\"case\":" + quoted(PLL::caseName(ss.state)) + ",\"moves\":" + moves(PLL::solve(ss.state)) + "}";
    }
    if (cmd == "cfop") return cfop(ss.state);
    if (cmd == "kociemba") return "{\"moves\":" + moves(Kociemba::solve(ss.state)) + "}";
    // Timer commands, stateless: the cube a scramble reaches, and its analysis
    if (cmd == "preview") { Session view; view.state = scrambled(q["scramble"]); return snapshot(view); }
    if (cmd == "analyze") return analyze(q["scramble"]);
    return err("Unknown command: " + cmd);
}

} // namespace

static Session session;

extern "C" {

// Builds every table the commands use, once, before the first engine_call
EMSCRIPTEN_KEEPALIVE void engine_init() {
    Kociemba::buildTables();
    F2L::buildTables();
    OLL::buildTables();
    PLL::buildTables();
}

// Runs one command against the tab's session and returns its JSON, an {"error": ...}
// object for a bad command or parameter. The string stays valid until the next call
EMSCRIPTEN_KEEPALIVE const char* engine_call(const char* cmd, const char* params) {
    static std::string out;
    auto q = query(params);
    try {
        out = handle(session, cmd, q);
    } catch (const std::exception& e) {
        out = "{\"error\":" + quoted(e.what()) + "}";
    }
    return out.c_str();
}

} // extern "C"
