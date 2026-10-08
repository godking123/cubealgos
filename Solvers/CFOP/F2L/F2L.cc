#include "F2L.h"
#include <unordered_map>
#include "F2LAlgos.h"
#include "../Cross/Cross.h"
#include "../PieceSearch.h"
#include "../../../CubeState/Rotation.h"
#include "../../../CubeState/Scramble.h"

namespace F2L {

int corner(int slot) { return 4 + slot; }
int edge(int slot)   { return 8 + slot; }

// Tracked Pieces for a Set of Slots, Cross Included
static uint16_t edgeMask(int slots) {
    uint16_t mask = Cross::EDGES;
    for (int i = 0; i < SLOTS; i++)
        if (slots & (1 << i)) mask |= 1 << edge(i);
    return mask;
}

static uint8_t cornerMask(int slots) {
    uint8_t mask = 0;
    for (int i = 0; i < SLOTS; i++)
        if (slots & (1 << i)) mask |= 1 << corner(i);
    return mask;
}

const int ALL_SLOTS = (1 << SLOTS) - 1;

bool isSolved(const CubeState& s) {
    return PieceSearch::isSolved(s, edgeMask(ALL_SLOTS), cornerMask(ALL_SLOTS));
}

static std::unordered_map<uint64_t, std::vector<Move>> table;  // Key : Moves to Insert
static Orientation frames[SLOTS];                              // Slot Seen as FR

// Slot and twist of the FR pair only, the rest of the cube is left to the alg
static uint64_t encode(const CubeState& s) {
    return PieceSearch::encode(s, 1 << edge(0), 1 << corner(0));
}

// The case an alg solves is the alg undone on a solved cube
// An alg that disturbs the cross or another pair would break placed slots, so it is
// left out rather than trusted
static void insert(const std::vector<Move>& seq) {
    CubeState s = CubeState::solved();
    for (int i = seq.size() - 1; i >= 0; i--) s = s.apply(inverseMove(seq[i]));
    int others = ALL_SLOTS & ~1;
    if (!PieceSearch::isSolved(s, edgeMask(others), cornerMask(others))) return;
    uint64_t key = encode(s);
    auto it = table.find(key);
    if (it == table.end() || seq.size() < it->second.size()) table[key] = seq;
}

// Every alg is written for the FR slot, so the other slots are solved from a y turned
// frame whose front face is the slot's own: F, L, B, R for slots 0 to 3
void buildTables() {
    static const std::vector<std::vector<Move>> AUF = {
        {}, {Move::U}, {Move::U2}, {Move::Up}
    };
    table.clear();
    insert({});
    for (const F2LAlgo& a : F2L_ALGS) {
        std::vector<Move> alg = parseSequence(a.moves);
        for (const auto& pre : AUF) {
            std::vector<Move> seq = pre;
            seq.insert(seq.end(), alg.begin(), alg.end());
            insert(canonicalize(seq));
        }
    }

    static const Move FRONT[SLOTS] = {Move::F, Move::L, Move::B, Move::R};
    Orientation o;
    for (int turn = 0; turn < 4; turn++, o = o.then(CubeRot::y))
        for (int slot = 0; slot < SLOTS; slot++)
            if (translateMove(Move::F, o) == FRONT[slot]) frames[slot] = o;
}

int tableSize() {
    return table.size();  // 150 When Every Case Is Present, Solved Included
}

const std::vector<std::vector<Move>>& extracts() {
    static const std::vector<std::vector<Move>> EXTRACTS = {
        {Move::R, Move::U, Move::Rp},  {Move::R, Move::Up, Move::Rp},  {Move::R, Move::U2, Move::Rp},
        {Move::Fp, Move::U, Move::F},  {Move::Fp, Move::Up, Move::F},  {Move::Fp, Move::U2, Move::F},
    };
    return EXTRACTS;
}

// The table alg for the pair as it stands, in the cube's own frame
static bool tableAlg(const CubeState& s, int slot, std::vector<Move>& out) {
    auto it = table.find(encode(s.rotate(frames[slot])));
    if (it == table.end()) return false;
    out = it->second;
    for (Move& m : out) m = translateMove(m, frames[slot]);
    return true;
}

// Other slots holding one of the pair's pieces, as a slot mask
static int stuckIn(const CubeState& s, int slot) {
    int mask = 0;
    for (int k = 0; k < SLOTS; k++) {
        if (k == slot) continue;
        if (s.cp[corner(k)] == corner(slot) || s.ep[edge(k)] == edge(slot)) mask |= 1 << k;
    }
    return mask;
}

// Two Stuck Pieces Need at Most Two Extracts
const int MAX_EXTRACTS = 2;

// Shortest extracts-then-alg for the pair, false when none fits within depth
//
// Each stuck slot is emptied by one of its extracts, which brings the piece to the U
// layer, so after at most one extract per stuck piece the pair is a table case.
// Adjacent turns of the joined sequence are merged, as a solver would
static bool extractThenAlg(const CubeState& s, int slot, int depth, F2LPair& best) {
    std::vector<Move> alg;
    if (tableAlg(s, slot, alg)) {
        best = {slot, alg, 0, false};
        return true;
    }
    if (depth == 0) return false;

    bool found = false;
    int stuck = stuckIn(s, slot);
    for (int k = 0; k < SLOTS; k++) {
        if (!(stuck & (1 << k))) continue;
        for (const std::vector<Move>& e : extracts()) {
            std::vector<Move> lift;
            CubeState next = s;
            for (Move m : e) { lift.push_back(translateMove(m, frames[k])); next = next.apply(lift.back()); }

            F2LPair rest;
            if (!extractThenAlg(next, slot, depth - 1, rest)) continue;
            lift.insert(lift.end(), rest.moves.begin(), rest.moves.end());
            std::vector<Move> seq = canonicalize(lift);
            if (!found || seq.size() < best.moves.size()) {
                best = {slot, seq, rest.extracted + 1, false};
                found = true;
            }
        }
    }
    return found;
}

F2LPair planPair(const CubeState& s, int slot, int placed) {
    F2LPair p;
    if (extractThenAlg(s, slot, MAX_EXTRACTS, p)) return p;

    // Safety Net, No Alg Fit
    int tracked = placed | (1 << slot);
    return {slot, PieceSearch::solve(s, edgeMask(tracked), cornerMask(tracked)), 0, true};
}

std::vector<Move> solvePair(const CubeState& s, int slot, int placed) {
    return planPair(s, slot, placed).moves;
}

// A pair is ranked by how it is solved first, then by length: a table case as it
// stands, then extract and alg, then the search
static bool better(const F2LPair& a, const F2LPair& b) {
    auto rank = [](const F2LPair& p) { return p.searched ? 2 : p.extracted ? 1 : 0; };
    if (rank(a) != rank(b)) return rank(a) < rank(b);
    return a.moves.size() < b.moves.size();
}

std::vector<F2LPair> solve(const CubeState& s) {
    std::vector<F2LPair> result;
    CubeState state = s;
    int placed = 0;

    while (placed != ALL_SLOTS) {
        F2LPair best;
        bool found = false;

        for (int slot = 0; slot < SLOTS; slot++) {
            if (placed & (1 << slot)) continue;
            F2LPair p = planPair(state, slot, placed);
            if (!found || better(p, best)) {
                best  = p;
                found = true;
            }
        }

        for (Move m : best.moves) state = state.apply(m);
        placed |= 1 << best.slot;
        result.push_back(best);
    }
    return result;
}

} // namespace F2L
