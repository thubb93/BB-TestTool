export function extractGaps(markdown: string): string[] {
  const gaps: string[] = []
  const lines = markdown.split('\n')
  let inGapsSection = false

  for (const line of lines) {
    if (/step\s*3|gaps?\s*found|missing|ambiguous|clarification/i.test(line) && /^#+/.test(line)) {
      inGapsSection = true
      continue
    }
    if (/^#+/.test(line) && inGapsSection) {
      if (!/gaps?\s*found|missing|ambiguous|clarification/i.test(line)) {
        inGapsSection = false
      }
      continue
    }
    if (inGapsSection && /^[\s-]*-\s*\[\s*\]\s+/.test(line)) {
      const text = line.replace(/^[\s-]*-\s*\[\s*\]\s+/, '').trim()
      if (text) gaps.push(text)
    }
  }

  return gaps
}

export function buildGapsBlock(gaps: string[]) {
  const gapLines = gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')

  return {
    text: `Found ${gaps.length} gap(s) in the spec. Want to clarify them?`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🔍 ${gaps.length} gap(s) need clarification` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`\n${gapLines}\n\`\`\``,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*Want to clarify these gaps?*`,
            `• Reply with answers, then say *"run"* to re-analyze with full context`,
            `• Say *"skip"* to close and keep the current report`,
          ].join('\n'),
        },
      },
    ],
  }
}
