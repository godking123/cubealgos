#include "PieceSearch.h"
#include <queue>
#include <unordered_map>

namespace PieceSearch {

// Five bits per tracked piece, appended in piece order: slot then orientation
// Twelve pieces at most, so the key stays inside 60 bits
uint64_t encode(const CubeState& s, uint16_t edges, uint8_t corners) {
    int edgeSlot[12], cornerSlot[8];
    for (int slot = 0; slot < 12; slot++) edgeSlot[s.ep[slot]]   = slot;
    for (int slot = 0; slot < 8;  slot++) cornerSlot[s.cp[slot]] = slot;

    // 64 Bit Int (60 Used)
    uint64_t key = 0;
    for (int piece = 0; piece < 12; piece++) {
        if (!(edges & (1 << piece))) continue;
        int slot = edgeSlot[piece];
        key = (key << 5) | (slot << 1) | s.eo[slot];
    }
    for (int piece = 0; piece < 8; piece++) {
        if (!(corners & (1 << piece))) continue;
        int slot = cornerSlot[piece];
        key = (key << 5) | (slot << 2) | s.co[slot];
    }
    return key;
}

bool isSolved(const CubeState& s, uint16_t edges, uint8_t corners) {
    return encode(s, edges, corners) == encode(CubeState::solved(), edges, corners);
}

namespace {

// One Side of the Bidirectional Search
struct Frontier {
    std::queue<std::pair<CubeState, std::vector<Move>>> queue;
    std::unordered_map<uint64_t, std::vector<Move>> seen;   // Key : Moves to Get There

    Frontier(const CubeState& start, uint16_t edges, uint8_t corners) {
        seen[encode(start, edges, corners)] = {};
        queue.push({start, {}});
    }
};

// Forward path, then the backward path reversed and inverted
std::vector<Move> joinPaths(const std::vector<Move>& forward,
                            const std::vector<Move>& backward) {
    std::vector<Move> solution = forward;
    for (int j = backward.size() - 1; j >= 0; j--) {
        solution.push_back(inverseMove(backward[j]));
    }
    return solution;
}

// One Level of BFS
std::vector<Move> expand(Frontier& mine, const Frontier& other, bool isForward,
                         uint16_t edges, uint8_t corners) {
    int levelSize = mine.queue.size();
    for (int i = 0; i < levelSize; i++) {
        auto [state, path] = mine.queue.front();
        mine.queue.pop();

        for (int m = 0; m < 18; m++) {
            CubeState next = state.apply(static_cast<Move>(m));
            uint64_t key = encode(next, edges, corners);

            if (mine.seen.count(key) == 1) continue;
            std::vector<Move> newPath = path;
            newPath.push_back(static_cast<Move>(m));

            // Found a Solution
            auto hit = other.seen.find(key);
            if (hit != other.seen.end()) {
                return isForward ? joinPaths(newPath, hit->second)
                                 : joinPaths(hit->second, newPath);
            }

            mine.seen[key] = newPath;
            mine.queue.push({next, newPath});
        }
    }
    return {};
}

} // namespace

std::vector<Move> solve(const CubeState& s, uint16_t edges, uint8_t corners) {
    if (isSolved(s, edges, corners)) return {};
    Frontier forward(s, edges, corners);
    Frontier backward(CubeState::solved(), edges, corners);

    // Always Grow the Smaller Side
    while (!forward.queue.empty() && !backward.queue.empty()) {
        std::vector<Move> result;
        if (forward.queue.size() <= backward.queue.size())
            result = expand(forward, backward, true, edges, corners);
        else
            result = expand(backward, forward, false, edges, corners);
        if (!result.empty()) return result;
    }
    return {};
}

} // namespace PieceSearch
