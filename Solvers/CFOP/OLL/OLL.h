#ifndef OLL_H
#define OLL_H

#include <cstdint>
#include <vector>
#include "../../../CubeState/CubeState.h"

// Orient the last layer, F2L already solved
// Every call reads only the U layer, slots 0 to 3 of both corners and edges
namespace OLL {
    uint32_t encode(const CubeState& s);  // Twist and Flip of the U Layer, 12 Bits
    bool isSolved(const CubeState& s);    // Every U Sticker Faces Up

    // Case Table, Every U Layer Orientation to the Moves That Orient It
    void buildTables();
    int tableSize();

    // Moves that orient the U layer, nothing if it is already oriented
    // or if the F2L below it is not solved
    std::vector<Move> solve(const CubeState& s);
} // namespace OLL

#endif // OLL_H
