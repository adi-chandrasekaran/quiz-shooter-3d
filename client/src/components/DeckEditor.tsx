import { useMemo, useState } from "react";
import type { Question } from "../types";

const starterText = `What is 7 × 8?
54
56 *
64

Which gas do plants absorb for photosynthesis?
Oxygen
Carbon dioxide *
Nitrogen

What is the capital of Japan?
Seoul
Kyoto
Tokyo *
Osaka`;

export function parseDeck(raw: string): Question[] {
  return raw
    .split(/\n\s*\n/g)
    .map((block, index) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const prompt = lines[0] ?? "";
      const answerLines = lines.slice(1);
      const choices = answerLines.map((line, choiceIndex) => ({
        id: String.fromCharCode(97 + choiceIndex),
        text: line.replace(/\s*\*$/, "")
      }));

      const correctIndex = answerLines.findIndex((line) => line.endsWith("*"));

      return {
        id: `q${index + 1}`,
        prompt,
        choices,
        correctChoiceId: choices[Math.max(0, correctIndex)]?.id ?? choices[0]?.id ?? "a"
      };
    })
    .filter((q) => q.prompt && q.choices.length >= 2);
}

export default function DeckEditor({
  onDeckChange
}: {
  onDeckChange: (deck: Question[]) => void;
}) {
  const [raw, setRaw] = useState(starterText);

  const deck = useMemo(() => parseDeck(raw), [raw]);

  function applyDeck() {
    onDeckChange(deck);
  }

  return (
    <div className="form-stack">
      <p className="muted">
        Put one question per block. Add <strong>*</strong> after the correct answer.
      </p>
      <textarea
        className="textarea"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
      />
      <div className="button-row">
        <button className="secondary-btn" onClick={applyDeck}>
          Apply Question Deck
        </button>
        <span className="muted">{deck.length} questions detected</span>
      </div>
    </div>
  );
}
