#include "OLL.h"
#include <unordered_map>
#include "OLLAlgos.h"
#include "../../../CubeState/Scramble.h"

namespace OLL {

static std::unordered_map<uint32_t, std::vector<Move>> table;  // Key : Moves to Orient

// Two bits per U corner then one per U edge, slot order
// U turns do not twist or flip, so the key changes only through the slots pieces sit in
uint32_t encode(const CubeState& s) {
    uint32_t key = 0;
    for (int i = 0; i < 4; i++) key = (key << 2) | s.co[i];
    for (int i = 0; i < 4; i++) key = (key << 1) | s.eo[i];
    return key;
}

bool isSolved(const CubeState& s) {
    return encode(s) == 0;
}

// The case an alg solves is the alg undone on a solved cube
static void insert(const std::vector<Move>& seq) {
    CubeState s = CubeState::solved();
    for (int i = seq.size() - 1; i >= 0; i--) s = s.apply(inverseMove(seq[i]));
    uint32_t key = encode(s);
    auto it = table.find(key);
    if (it == table.end() || seq.size() < it->second.size()) table[key] = seq;
}

// Each alg is written for one angle, so the U turn that lines the case up is baked
// into the table rather than searched for at solve time.
void buildTables() {
    static const std::vector<std::vector<Move>> AUF = {
        {}, {Move::U}, {Move::U2}, {Move::Up}
    };
    table.clear();
    insert({});
    for (const OLLAlgo& a : OLL_ALGS) {
        std::vector<Move> alg = parseSequence(a.moves);
        for (const auto& pre : AUF) {
            std::vector<Move> seq = pre;
            seq.insert(seq.end(), alg.begin(), alg.end());
            insert(canonicalize(seq));
        }
    }
}

int tableSize() {
    return table.size();  // 216 When Every Case Is Present
}

std::vector<Move> solve(const CubeState& s) {
    auto it = table.find(encode(s));
    if (it == table.end()) return {};
    return it->second;
}

} // namespace OLL
