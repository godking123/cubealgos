CXX = g++
CXXFLAGS = -std=c++17 -Wall -O2 -MMD -MP
BUILD = .build
ROOT = ../..

# Cube representation, moves, scrambles and rotations
CORE = $(ROOT)/CubeState/CubeState.cc $(ROOT)/CubeState/MoveTable.cc \
       $(ROOT)/CubeState/Scramble.cc $(ROOT)/CubeState/Rotation.cc

# The WCA scrambler solves a random state with Kociemba, so it pulls the solver in
KOCIEMBA = $(ROOT)/Solvers/KociembaNaive/Coords.cc \
           $(ROOT)/Solvers/KociembaNaive/CoordTables.cc \
           $(ROOT)/Solvers/KociembaNaive/Phase1.cc \
           $(ROOT)/Solvers/KociembaNaive/Phase2.cc \
           $(ROOT)/Solvers/KociembaNaive/Kociemba.cc
SCRAMBLERS = $(ROOT)/Scramblers/WCA.cc

SRCS = cfop-test.cc PieceSearch.cc Cross/Cross.cc F2L/F2L.cc OLL/OLL.cc PLL/PLL.cc \
       $(CORE) $(KOCIEMBA) $(SCRAMBLERS)
OBJS = $(addprefix $(BUILD)/,$(notdir $(SRCS:.cc=.o)))

.PHONY: all
all: cfop-test

cfop-test: $(OBJS)
	$(CXX) $(CXXFLAGS) $^ -o $@

$(BUILD)/%.o: %.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Cross/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: F2L/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: OLL/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: PLL/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: $(ROOT)/CubeState/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: $(ROOT)/Solvers/KociembaNaive/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: $(ROOT)/Scramblers/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD):
	@mkdir -p $(BUILD)

-include $(OBJS:.o=.d)

.PHONY: run
run: cfop-test
	./cfop-test

.PHONY: clean
clean:
	rm -rf $(BUILD) cfop-test
