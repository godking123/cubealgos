#ifndef PLL_H
#define PLL_H

#include <cstdint>
#include <vector>
#include "../../../CubeState/CubeState.h"

// Permute the last layer, F2L solved and U layer oriented
// Every call reads only the U layer, slots 0 to 3 of both corners and edges
namespace PLL {
    uint32_t encode(const CubeState& s);  // Which Piece Sits in Each U Slot, 16 Bits
    bool isSolved(const CubeState& s);    // Cube Solved

    // Case Table, Every U Layer Permutation to the Moves That Solve It
    void buildTables();
    int tableSize();

    // Moves that finish the cube, nothing if it is already solved
    // or if the layers below are not solved and oriented
    std::vector<Move> solve(const CubeState& s);
} // namespace PLL

#endif // PLL_H
