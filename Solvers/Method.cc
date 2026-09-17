#include "Method.h"
#include "KociembaNaive/Kociemba.h"
#include "CFOP/CFOP.h"
#include "Roux/Roux.h"

const Method METHODS[3] = {
    {"Kociemba", "two-phase IDA* search, 18-22 moves", true,
     Kociemba::buildTables, Kociemba::solve},
    {"CFOP",     "cross, F2L, OLL, PLL",               true,
     CFOP::buildTables,     CFOP::solve},
    {"Roux",     "blocks, CMLL, LSE",                  false,
     Roux::buildTables,     Roux::solve},
};

const int METHOD_COUNT = 3;
