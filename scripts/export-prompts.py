"""Turns the Claude Code session JSONL into docs/prompts/01-*.md (R-12).

Keeps every user prompt and every assistant text reply, in order; tool calls are listed by
name with a short input summary (their raw output is omitted: it is data, often huge, and may
contain local paths). Values of the local .env are redacted wherever they appear.
"""
import json, re, sys

src, out, env_path = sys.argv[1], sys.argv[2], sys.argv[3]
import os
INTENTS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prompt-intents.json'), encoding='utf-8'))

def intent_for(text):
    for prefix, why in INTENTS.items():
        if prefix in text[:400]:
            return why
    return None

def owner_prompt(lines, turn, ts, text, suffix=''):
    """The instruction in engineering terms first, the owner's verbatim prompt folded below it."""
    why = intent_for(text)
    lines += [f'## Prompt {turn} — {ts}{suffix}', '']
    if why:
        lines += ['**Instruction (technical):** ' + why, '']
    lines += ['<details><summary>Original prompt (verbatim)</summary>', '', redact(text), '', '</details>', '']

secrets = []
for line in open(env_path, encoding='utf-8'):
    m = re.match(r'^([A-Z0-9_]+)=(.+)$', line.strip())
    if m and len(m.group(2)) >= 8 and any(k in m.group(1) for k in ('SECRET', 'PASSWORD', 'KEY', 'TOKEN')):
        secrets.append(m.group(2))

def redact(text):
    for s in secrets:
        text = text.replace(s, '«redacted»')
    text = re.sub(r'(token=exp=\d+~hmac=)[0-9a-f]+', r'\1«redacted»', text)
    return text

def text_of(content):
    if isinstance(content, str):
        return content
    parts = []
    for c in content:
        if c.get('type') == 'text':
            parts.append(c['text'])
    return '\n'.join(parts)

DIRECTING_TOOLS = ('Agent', 'Task', 'SendMessage')
agent_calls = {}  # tool_use id -> description, so the subagent's direct answer can be quoted


def directives_of(content):
    """Full prompts the main agent gave to subagents (how the AI was directed, R-12)."""
    if isinstance(content, str):
        return []
    blocks = []
    for c in content:
        if c.get('type') == 'tool_use' and c['name'] in DIRECTING_TOOLS:
            inp = c.get('input', {})
            label = inp.get('description') or inp.get('summary') or inp.get('to') or c['name']
            body = inp.get('prompt') or inp.get('message') or ''
            agent_calls[c['id']] = label
            blocks += [f'<details><summary>{c["name"]} — {label} (full instruction)</summary>', '', redact(str(body)), '', '</details>', '']
    return blocks


def tools_of(content):
    if isinstance(content, str):
        return []
    calls = []
    for c in content:
        if c.get('type') == 'tool_use' and c['name'] not in DIRECTING_TOOLS:
            inp = c.get('input', {})
            hint = inp.get('description') or inp.get('file_path') or inp.get('command') or inp.get('prompt') or inp.get('query') or ''
            hint = str(hint).replace('\n', ' ')
            calls.append(f"`{c['name']}`" + (f" — {hint[:160]}" if hint else ''))
    return calls

lines = ['# Session 01 — full transcript', '',
         'Verbatim user prompts and assistant replies of the Claude Code session that built this',
         'project, in order. Each owner prompt shows its instruction in technical terms (written at',
         'delivery) and, folded below it, the prompt exactly as typed. Instructions',
         'given to subagents are quoted in full with their answers;',
         'other tool calls are listed by name and short input, their raw outputs omitted.',
         'Secrets from the local `.env` are redacted.', '']
turn = 0
for raw in open(src, encoding='utf-8'):
    try:
        e = json.loads(raw)
    except json.JSONDecodeError:
        continue
    if e.get('isSidechain'):
        continue
    att = e.get('attachment') or {}
    if e.get('type') == 'attachment' and att.get('type') == 'queued_command' and att.get('humanTurn'):
        prompt = att.get('prompt')
        if isinstance(prompt, list):
            prompt = '\n'.join(c.get('text', '[image attached]') if c.get('type') == 'text' else '[image attached]' for c in prompt)
        turn += 1
        ts = (e.get('timestamp') or '')[:16].replace('T', ' ')
        owner_prompt(lines, turn, ts, str(prompt), ' (sent while Claude was working)')
        continue
    if e.get('type') not in ('user', 'assistant'):
        continue
    msg = e.get('message') or {}
    content = msg.get('content', '')
    ts = (e.get('timestamp') or '')[:16].replace('T', ' ')
    if e['type'] == 'user':
        if isinstance(content, list) and all(c.get('type') == 'tool_result' for c in content):
            for c in content:
                body = c.get('content')
                body = body if isinstance(body, str) else text_of(body or [])
                label = agent_calls.get(c.get('tool_use_id'))
                if label and 'Async agent launched' not in body and 'queued for delivery' not in body:
                    lines += [f'<details><summary>Subagent answer — {label}</summary>', '', redact(body), '', '</details>', '']
                if re.search(r'answered your questions|The user answered|questions have been answered|User has answered', body):
                    lines += ["**Owner's answer (question dialog):**", '', redact(body.split('. You can now')[0]), '']
            continue
        txt = text_of(content).strip()
        if not txt or txt.startswith('<') and ('system-reminder' in txt[:40] or 'task-notification' in txt[:60] or 'command-' in txt[:30]):
            # harness notifications and slash-command plumbing, not prompts
            if not txt.startswith('<command-message>') and 'agent-message' not in txt[:200]:
                continue
        if 'agent-message' in txt[:300]:
            lines += [f'#### Subagent report ({ts})', '', '> ' + redact(txt).replace('\n', '\n> '), '']
            continue
        if txt.startswith('Base directory for this skill:'):
            name = txt.split('skills', 1)[-1].split('\n', 1)[0].strip('\\/ ')
            lines += [f'<details><summary>Skill instructions loaded by the slash command ({name}) — not typed by the owner</summary>', '', redact(txt), '', '</details>', '']
            continue
        if txt.startswith('This session is being continued from a previous conversation'):
            lines += ['<details><summary>Automatic context summary (the conversation hit the context limit) — not typed by the owner</summary>', '', redact(txt), '', '</details>', '']
            continue
        if all(l.startswith('[Image') or not l.strip() for l in txt.splitlines()):
            lines += ['*Screenshots attached to the prompt above:* ' + ' '.join(l.strip() for l in txt.splitlines() if l.strip()), '']
            continue
        turn += 1
        owner_prompt(lines, turn, ts, txt)
    else:
        txt = text_of(content).strip()
        calls = tools_of(content)
        if txt:
            lines += ['**Claude:**', '', redact(txt), '']
        lines += directives_of(content)
        if calls:
            lines += ['<details><summary>Tool calls</summary>', '', *['- ' + redact(c) for c in calls], '', '</details>', '']

open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
print('prompts:', turn, 'bytes:', len('\n'.join(lines)))
