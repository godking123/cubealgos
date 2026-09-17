#ifndef CFOP_H
#define CFOP_H

#include <vector>
#include "../../CubeState/CubeState.h"
#include "../Method.h"

namespace CFOP {
    void buildTables();

    // Cross, F2L, OLL, PLL in the scrambling frame, as one sequence or one per stage
    // A stage that has nothing to do comes back with no moves
    std::vector<Move> solve(const CubeState& s);
    std::vector<Stage> stages(const CubeState& s);
} // namespace CFOP

#endif // CFOP_H
