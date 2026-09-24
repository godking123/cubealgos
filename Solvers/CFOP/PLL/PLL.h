#ifndef PLL_H
#define PLL_H

#include <cstdint>
#include <string>
#include <vector>
#include "../../../CubeState/CubeState.h"

// Permute the last layer, F2L solved and U layer oriented
namespace PLL {
    uint32_t encode(const CubeState& s);  // Which Piece Sits in Each U Slot, 16 Bits
    bool isSolved(const CubeState& s);    // Cube Solved

    // Case Table, Every U Layer Permutation to the Moves That Solve It
    void buildTables();
    int tableSize();

    // Moves that finish the cube, nothing if it is already solved
    std::vector<Move> solve(const CubeState& s);

    // Name of the alg solve uses, empty when a U turn alone finishes the cube
    std::string caseName(const CubeState& s);
} // namespace PLL

#endif // PLL_H
