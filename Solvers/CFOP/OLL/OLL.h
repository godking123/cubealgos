#ifndef OLL_H
#define OLL_H

#include <cstdint>
#include <string>
#include <vector>
#include "../../../CubeState/CubeState.h"

// Orient the last layer, F2L already solved
namespace OLL {
    uint32_t encode(const CubeState& s);  // Twist and Flip of the U Layer, 12 Bits
    bool isSolved(const CubeState& s);    // Every U Sticker Faces Up

    // Case Table, Every U Layer Orientation to the Moves That Orient It
    void buildTables();
    int tableSize();

    // Moves that orient the U layer
    std::vector<Move> solve(const CubeState& s);

    // Name of the alg solve uses, empty when the layer is already oriented
    std::string caseName(const CubeState& s);
} // namespace OLL

#endif // OLL_H
