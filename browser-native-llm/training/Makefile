# SMART Planner Model Training Pipeline
#
# Full pipeline: make all
# Individual stages: make data, make pretrain, make sft, make dpo, make export
#
# Prerequisites:
#   pip install -r requirements.txt
#   Set TEACHER_API_KEY for synthetic data generation (Anthropic or OpenAI)

SHELL := /bin/bash
PYTHON := python3

# Directories
DATA_DIR := ./data
CHECKPOINT_DIR := ./checkpoints
EXPORT_DIR := ./export

# Config files
MODEL_CONFIG := ./config/model_config.yaml
PRETRAIN_CONFIG := ./config/pretrain_config.yaml
SFT_CONFIG := ./config/sft_config.yaml
DPO_CONFIG := ./config/dpo_config.yaml

# Data generation parameters
NUM_PROMPTS := 10000
SEED := 42

.PHONY: all clean data pretrain sft dpo export quantize validate help

help:
	@echo "SMART Planner Training Pipeline"
	@echo ""
	@echo "Stages (run in order):"
	@echo "  make data       - Generate synthetic training prompts"
	@echo "  make pretrain   - Stage 1: Pretrain on English + planning data"
	@echo "  make sft        - Stage 2: Supervised fine-tuning on SMART actions"
	@echo "  make dpo        - Stage 3: DPO preference optimisation"
	@echo "  make export     - Export to ONNX + GGUF for browser deployment"
	@echo "  make quantize   - Quantize exported models (int8, q4)"
	@echo ""
	@echo "Shortcuts:"
	@echo "  make all        - Run full pipeline (data → pretrain → sft → dpo → export)"
	@echo "  make validate   - Validate model architecture (no GPU needed)"
	@echo "  make clean      - Remove checkpoints and generated data"

all: data pretrain sft dpo export quantize

# --- Stage 0: Data Generation ---

data: $(DATA_DIR)/prompts.jsonl $(DATA_DIR)/preferences

$(DATA_DIR)/prompts.jsonl:
	@echo "=== Generating synthetic training prompts ==="
	$(PYTHON) $(DATA_DIR)/generate_synthetic.py \
		--output $(DATA_DIR)/prompts.jsonl \
		--num-examples $(NUM_PROMPTS) \
		--seed $(SEED)

$(DATA_DIR)/preferences: $(DATA_DIR)/prompts.jsonl
	@echo "=== Generating DPO preference pairs ==="
	@mkdir -p $(DATA_DIR)/preferences
	$(PYTHON) $(DATA_DIR)/preference_pairs.py \
		--dataset $(DATA_DIR)/scored_dataset.jsonl \
		--output-dir $(DATA_DIR)/preferences/ \
		--seed $(SEED)

# --- Stage 1: Pretraining ---

pretrain: $(CHECKPOINT_DIR)/pretrain/latest
$(CHECKPOINT_DIR)/pretrain/latest:
	@echo "=== Stage 1: Pretraining ==="
	cd model && $(PYTHON) pretrain.py --config ../$(PRETRAIN_CONFIG)

# --- Stage 2: SFT ---

sft: $(CHECKPOINT_DIR)/sft/latest
$(CHECKPOINT_DIR)/sft/latest: $(CHECKPOINT_DIR)/pretrain/latest
	@echo "=== Stage 2: Supervised Fine-Tuning ==="
	cd model && $(PYTHON) sft.py --config ../$(SFT_CONFIG)

# --- Stage 3: DPO ---

dpo: $(CHECKPOINT_DIR)/dpo/latest
$(CHECKPOINT_DIR)/dpo/latest: $(CHECKPOINT_DIR)/sft/latest $(DATA_DIR)/preferences
	@echo "=== Stage 3: DPO ==="
	cd model && $(PYTHON) dpo.py --config ../$(DPO_CONFIG)

# --- Export ---

export: $(EXPORT_DIR)/onnx/model.onnx $(EXPORT_DIR)/gguf/smart-planner-150m-f16.gguf

$(EXPORT_DIR)/onnx/model.onnx: $(CHECKPOINT_DIR)/dpo/latest
	@echo "=== Exporting to ONNX ==="
	cd export && $(PYTHON) export_onnx.py \
		--checkpoint ../$(CHECKPOINT_DIR)/dpo/final.pt \
		--output ../$(EXPORT_DIR)/onnx/

$(EXPORT_DIR)/gguf/smart-planner-150m-f16.gguf: $(CHECKPOINT_DIR)/dpo/latest
	@echo "=== Exporting to GGUF ==="
	cd export && $(PYTHON) export_gguf.py \
		--checkpoint ../$(CHECKPOINT_DIR)/dpo/final.pt \
		--output ../$(EXPORT_DIR)/gguf/

# --- Quantization ---

quantize: $(EXPORT_DIR)/onnx/model.onnx
	@echo "=== Quantizing ONNX model (int8) ==="
	cd export && $(PYTHON) quantize.py \
		--input ../$(EXPORT_DIR)/onnx/model.onnx \
		--output ../$(EXPORT_DIR)/quantised/ \
		--method onnx-int8

# --- Validation (no GPU needed) ---

validate:
	@echo "=== Validating model architecture ==="
	cd model && $(PYTHON) architecture.py
	@echo ""
	@echo "=== Validating scoring rubric ==="
	cd data && $(PYTHON) smart_rubric.py
	@echo ""
	@echo "=== Architecture validation passed ==="

# --- Cleanup ---

clean:
	rm -rf $(CHECKPOINT_DIR)
	rm -rf $(EXPORT_DIR)
	rm -f $(DATA_DIR)/prompts.jsonl
	rm -f $(DATA_DIR)/scored_dataset.jsonl
	rm -rf $(DATA_DIR)/preferences
	@echo "Cleaned checkpoints, exports, and generated data"
