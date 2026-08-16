#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""模型速度基准测试: 测每个模型的 首字延迟(TTFT) + 总耗时 + 字符数
用与 App 完全相同的 系统提示词/参数/问题, 模拟真实使用场景"""
import re, time, json, sys

env = open(r"C:\Users\chenm\AppData\Local\hermes\.env", encoding="utf-8").read()
dskey = re.search(r"DEEPSEEK_API_KEY=(\S+)", env).group(1)
orkey = re.search(r"OPENROUTER_API_KEY=(\S+)", env).group(1)

from openai import OpenAI
ds = OpenAI(api_key=dskey, base_url="https://api.deepseek.com", timeout=60)
or_ = OpenAI(api_key=orkey, base_url="https://openrouter.ai/api/v1", timeout=60)

cfg = json.load(open("config.json", encoding="utf-8"))
p = cfg["profile"]
sys_msg = (
    "你是一位资深面试官教练, 正在帮应聘者实时准备面试回答。\n"
    f"应聘者背景: {p['resume_summary']}\n"
    f"目标岗位: {p['target_role']}"
    + (f" / 公司: {p['company']}" if p.get("company") else "")
    + (f"\n岗位要求(JD): {p['jd']}" if p.get("jd") else "")
    + "\n\n要求:\n"
    "1. 直接输出应聘者可以照着念的完整回答, 不要任何开场白、解释或\"你可以这样说\"。\n"
    f"2. 风格: {p['style']}\n"
    "3. 简洁, 控制在 150~250 字(英文约 80~150 词)。\n"
    "4. 技术题给准确答案并简短说明理由; 行为题用 STAR 结构。\n"
    "5. 回答语言跟随提问语言。"
)
QUESTION = "What is the difference between OOP and functional programming?"
messages = [
    {"role": "system", "content": sys_msg},
    {"role": "user", "content": f"面试官提问: {QUESTION}\n\n请给出回答:"},
]

MODELS = [
    ("deepseek", "deepseek-v4-flash", "DeepSeek V4 Flash (直连)"),
    ("openrouter", "openai/gpt-4o-mini", "GPT-4o mini (OR)"),
    ("openrouter", "google/gemini-2.5-flash", "Gemini 2.5 Flash (OR)"),
    ("openrouter", "deepseek/deepseek-chat", "DeepSeek Chat (OR)"),
    ("deepseek", "deepseek-v4-pro", "DeepSeek V4 Pro (直连)"),
    ("openrouter", "openai/gpt-4o", "GPT-4o (OR)"),
    ("openrouter", "z-ai/glm-4.6", "GLM-4.6 (OR)"),
    ("openrouter", "mistralai/mistral-large-2512", "Mistral Large (OR)"),
    ("openrouter", "meta-llama/llama-3.3-70b-instruct", "Llama 3.3 70B (OR)"),
    ("openrouter", "openai/o3-mini", "o3-mini (OR)"),
]


def run(client, model):
    kwargs = dict(model=model, messages=messages, max_tokens=600, stream=True)
    if not model.startswith(("o1", "o3")):
        kwargs["temperature"] = 0.5
    if client is ds:
        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
    t0 = time.time()
    ttft, chars = None, 0
    try:
        stream = client.chat.completions.create(**kwargs)
        for ch in stream:
            d = ch.choices[0].delta
            c = getattr(d, "content", None) or ""
            if c:
                if ttft is None:
                    ttft = time.time() - t0
                chars += len(c)
        return ttft, time.time() - t0, chars, None
    except Exception as e:
        return None, None, 0, str(e)[:90]


if __name__ == "__main__":
    print(f"问题: {QUESTION}\n每个模型测 2 次\n", flush=True)
    rows = []
    for prov, model, label in MODELS:
        client = ds if prov == "deepseek" else or_
        for i in range(2):
            ttft, total, chars, err = run(client, model)
            rows.append((label, model, ttft, total, chars, err))
            if err:
                print(f"{label}: ❌ {err}", flush=True)
            else:
                print(f"{label} 第{i+1}次: 首字 {ttft*1000:.0f}ms | 总 {total:.2f}s | {chars} 字符", flush=True)
    print("\n===== 汇总 (取两次平均) =====", flush=True)
    agg = {}
    for label, model, ttft, total, chars, err in rows:
        if err:
            continue
        a = agg.setdefault(model, {"label": label, "ttft": [], "total": [], "chars": []})
        a["ttft"].append(ttft)
        a["total"].append(total)
        a["chars"].append(chars)
    ranked = sorted(agg.items(), key=lambda kv: sum(kv[1]["ttft"]) / len(kv[1]["ttft"]))
    print(f"{'模型':<28}{'首字平均':>10}{'总耗时平均':>12}{'字符':>8}{'1秒内首字':>10}", flush=True)
    for model, a in ranked:
        t_avg = sum(a["ttft"]) / len(a["ttft"])
        tot_avg = sum(a["total"]) / len(a["total"])
        ch = sum(a["chars"]) // len(a["chars"])
        flag = "✅" if t_avg <= 1.0 else ""
        print(f"{a['label']:<28}{t_avg*1000:>8.0f}ms{tot_avg:>11.2f}s{ch:>8}{flag:>10}", flush=True)
