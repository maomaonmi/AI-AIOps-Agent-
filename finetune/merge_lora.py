import argparse
import logging
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

import yaml

logger = logging.getLogger(__name__)


def merge_lora(config_path: str):
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    base_model_path = config["model"]["base_model"]
    lora_path = config["training"]["output_dir"]
    output_dir = config["merge"]["output_dir"]

    logger.info(f"Loading base model: {base_model_path}")
    tokenizer = AutoTokenizer.from_pretrained(
        base_model_path,
        trust_remote_code=config["model"].get("trust_remote_code", True),
    )

    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_path,
        trust_remote_code=config["model"].get("trust_remote_code", True),
        torch_dtype=torch.float16,
        device_map="cpu",
    )

    logger.info(f"Loading LoRA weights: {lora_path}")
    model = PeftModel.from_pretrained(base_model, lora_path)

    logger.info("Merging LoRA weights...")
    merged_model = model.merge_and_unload()

    logger.info(f"Saving merged model to: {output_dir}")
    merged_model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    logger.info("Merge complete! The merged model can be loaded directly without PEFT.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge LoRA weights into base model")
    parser.add_argument("--config", type=str, default="./finetune/config.yaml", help="Config file path")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    merge_lora(args.config)
