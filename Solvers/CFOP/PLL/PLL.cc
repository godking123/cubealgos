#include "PLL.h"
#include <unordered_map>
#include "PLLAlgos.h"
#include "../../../CubeState/Scramble.h"

namespace PLL {

// Moves to Solve and the Alg They Came From
struct Entry {
    std::vector<Move> moves;
    std::string name;
};

static std::unordered_map<uint32_t, Entry> table;  // Key : Entry

// Two bits per U corner then two per U edge, slot order
// Pieces 0 to 3 are the U layer, so each fits in two bits once F2L is solved
uint32_t encode(const CubeState& s) {
    uint32_t key = 0;
    for (int i = 0; i < 4; i++) key = (key << 2) | s.cp[i];
    for (int i = 0; i < 4; i++) key = (key << 2) | s.ep[i];
    return key;
}

bool isSolved(const CubeState& s) {
    return encode(s) == encode(CubeState::solved());
}

// The case an alg solves is the alg undone on a solved cube
static void insert(const std::vector<Move>& seq, const std::string& name = "") {
    CubeState s = CubeState::solved();
    for (int i = seq.size() - 1; i >= 0; i--) s = s.apply(inverseMove(seq[i]));
    uint32_t key = encode(s);
    auto it = table.find(key);
    if (it == table.end() || seq.size() < it->second.moves.size()) table[key] = {seq, name};
}

// A PLL needs a U turn before the alg to line the case up and one after to line the
// layer up, so both are baked into the table.
void buildTables() {
    static const std::vector<std::vector<Move>> AUF = {
        {}, {Move::U}, {Move::U2}, {Move::Up}
    };
    table.clear();
    for (const auto& pre : AUF) insert(pre);
    for (const PLLAlgo& a : PLL_ALGS) {
        std::vector<Move> alg = parseSequence(a.moves);
        for (const auto& pre : AUF) {
            for (const auto& post : AUF) {
                std::vector<Move> seq = pre;
                seq.insert(seq.end(), alg.begin(), alg.end());
                seq.insert(seq.end(), post.begin(), post.end());
                insert(canonicalize(seq), a.name);
            }
        }
    }
}

int tableSize() {
    return table.size();  // 288 When Every Case Is Present
}

std::vector<Move> solve(const CubeState& s) {
    auto it = table.find(encode(s));
    if (it == table.end()) return {};
    return it->second.moves;
}

std::string caseName(const CubeState& s) {
    auto it = table.find(encode(s));
    return it == table.end() ? "" : it->second.name;
}

} // namespace PLL
