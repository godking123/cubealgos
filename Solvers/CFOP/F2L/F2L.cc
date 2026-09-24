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

std::vector<Move> solvePair(const CubeState& s, int slot, int placed) {
    auto it = table.find(encode(s.rotate(frames[slot])));
    if (it != table.end()) {
        std::vector<Move> moves = it->second;
        for (Move& m : moves) m = translateMove(m, frames[slot]);
        return moves;
    }

    // Pair Piece Stuck in Another Slot
    int tracked = placed | (1 << slot);
    return PieceSearch::solve(s, edgeMask(tracked), cornerMask(tracked));
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
            std::vector<Move> moves = solvePair(state, slot, placed);
            if (!found || moves.size() < best.moves.size()) {
                best  = {slot, moves};
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
