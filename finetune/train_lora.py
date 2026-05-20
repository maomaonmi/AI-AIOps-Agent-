import json
import os
import argparse
import logging
from pathlib import Path

import torch
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForSeq2Seq,
)
from peft import LoraConfig, get_peft_model, TaskType

import yaml

logger = logging.getLogger(__name__)


def load_config(config_path: str) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_and_preprocess_data(data_path: str, val_size: float = 0.1) -> tuple:
    with open(data_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    dataset = Dataset.from_list(raw_data)
    if val_size > 0:
        split = dataset.train_test_split(test_size=val_size, seed=42)
        return split["train"], split["test"]
    return dataset, None


def format_prompt(example: dict, template: str) -> str:
    return template.format(
        instruction=example.get("instruction", ""),
        input=example.get("input", ""),
        output=example.get("output", ""),
    )


def tokenize_function(examples, tokenizer, max_source_length, max_target_length, template):
    prompts = []
    for i in range(len(examples["instruction"])):
        ex = {
            "instruction": examples["instruction"][i],
            "input": examples["input"][i],
            "output": examples["output"][i],
        }
        prompts.append(format_prompt(ex, template))

    model_inputs = tokenizer(
        prompts,
        max_length=max_source_length + max_target_length,
        truncation=True,
        padding=False,
    )

    model_inputs["labels"] = [
        input_ids[:] for input_ids in model_inputs["input_ids"]
    ]

    return model_inputs


def train(config_path: str):
    config = load_config(config_path)
    model_cfg = config["model"]
    lora_cfg = config["lora"]
    train_cfg = config["training"]
    data_cfg = config["data"]

    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        model_cfg["base_model"],
        trust_remote_code=model_cfg.get("trust_remote_code", True),
        padding_side="right",
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    logger.info("Loading base model...")
    model_kwargs = {
        "trust_remote_code": model_cfg.get("trust_remote_code", True),
        "torch_dtype": torch.float16 if train_cfg.get("fp16") else torch.float32,
    }
    if train_cfg.get("gradient_checkpointing"):
        model_kwargs["use_cache"] = False

    model = AutoModelForCausalLM.from_pretrained(
        model_cfg["base_model"],
        **model_kwargs,
    )

    logger.info("Configuring LoRA...")
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=lora_cfg["r"],
        lora_alpha=lora_cfg["lora_alpha"],
        lora_dropout=lora_cfg["lora_dropout"],
        target_modules=lora_cfg["target_modules"],
        bias=lora_cfg.get("bias", "none"),
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    logger.info("Loading training data...")
    train_dataset, val_dataset = load_and_preprocess_data(
        data_cfg["train_file"],
        data_cfg.get("val_size", 0.1),
    )

    logger.info("Tokenizing dataset...")
    tokenize_fn = lambda examples: tokenize_function(
        examples,
        tokenizer,
        data_cfg["max_source_length"],
        data_cfg["max_target_length"],
        data_cfg["prompt_template"],
    )

    train_dataset = train_dataset.map(
        tokenize_fn,
        batched=True,
        remove_columns=train_dataset.column_names,
    )
    if val_dataset:
        val_dataset = val_dataset.map(
            tokenize_fn,
            batched=True,
            remove_columns=val_dataset.column_names,
        )

    data_collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        padding=True,
        max_length=data_cfg["max_source_length"] + data_cfg["max_target_length"],
    )

    logger.info("Setting up training arguments...")
    training_args = TrainingArguments(
        output_dir=train_cfg["output_dir"],
        num_train_epochs=train_cfg["num_train_epochs"],
        per_device_train_batch_size=train_cfg["per_device_train_batch_size"],
        gradient_accumulation_steps=train_cfg["gradient_accumulation_steps"],
        learning_rate=train_cfg["learning_rate"],
        weight_decay=train_cfg["weight_decay"],
        warmup_ratio=train_cfg["warmup_ratio"],
        lr_scheduler_type=train_cfg["lr_scheduler_type"],
        max_grad_norm=train_cfg["max_grad_norm"],
        logging_steps=train_cfg["logging_steps"],
        save_steps=train_cfg["save_steps"],
        save_total_limit=train_cfg["save_total_limit"],
        fp16=train_cfg.get("fp16", False),
        gradient_checkpointing=train_cfg.get("gradient_checkpointing", False),
        seed=train_cfg.get("seed", 42),
        dataloader_num_workers=train_cfg.get("dataloader_num_workers", 4),
        remove_unused_columns=train_cfg.get("remove_unused_columns", False),
        evaluation_strategy="steps" if val_dataset else "no",
        eval_steps=train_cfg["save_steps"] if val_dataset else None,
        load_best_model_at_end=True if val_dataset else False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
    )

    logger.info("Starting training...")
    trainer.train()

    logger.info(f"Saving model to {train_cfg['output_dir']}")
    trainer.save_model()
    tokenizer.save_pretrained(train_cfg["output_dir"])

    logger.info("Training complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LoRA fine-tuning for AIOps Agent")
    parser.add_argument("--config", type=str, default="./finetune/config.yaml", help="Config file path")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    train(args.config)
