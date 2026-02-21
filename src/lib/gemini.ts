import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface MagicSpell {
  name: string;
  description: string;
  damage: number;
  heal: number;
  type: string;
}

export async function generateMagicFromBoard(boardString: string, casterDescription: string, isEnemy: boolean = false): Promise<MagicSpell> {
  const role = isEnemy ? "Enemy Monster (Evil Entity)" : "Player (Righteous Mage)";
  const tone = isEnemy ? "Sinister, destructive magic. Red, purple, black effects." : "Mystical, heroic magic. Blue, green, white effects.";

  const prompt = `
You are a Grimoire AI that generates magic spells from "Game of Life" board patterns.
Caster: ${casterDescription}
Current Turn: ${role}
Current Board State ('O' is alive, '.' is dead):

${boardString}

Based on the shape, arrangement pattern, and density of live cells on this board, generate one fantasy RPG "Magic Spell".
Image the tone: ${tone}
Reflect the caster's characteristics (${casterDescription}) in the spell name and description.
For example, if there's a glider-like shape, "Soaring Light Blade"; if a block, "Solid Shield"; if scattered randomly, "Meteor of Chaos". Be creative.

Return in the following JSON format:
{
  "name": "Spell Name",
  "description": "Visual and lore description of the spell (Flavor text)",
  "damage": Damage to enemy (Integer 0-50. High for attack spells, 0 for heal/buff),
  "heal": Self recovery amount (Integer 0-50. High for heal spells, 0 for attack),
  "type": "attack" | "heal" | "buff"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            damage: { type: Type.INTEGER },
            heal: { type: Type.INTEGER },
            type: { type: Type.STRING },
          },
          required: ["name", "description", "damage", "heal", "type"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as MagicSpell;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      name: "Mana Overload",
      description: "Failed to interpret the pattern, causing mana to go out of control!",
      damage: 5,
      heal: 0,
      type: "attack"
    };
  }
}

export async function generateImageFromSpell(spell: MagicSpell, casterDescription: string, isEnemy: boolean): Promise<string | null> {
  const colorTheme = isEnemy ? "red, black, purple, dark energy" : "green, blue, white, holy light";
  const prompt = `Fantasy RPG magic spell effect: ${spell.name}. ${spell.description}. 
  Caster: ${casterDescription}. 
  Color theme: ${colorTheme}.
  High quality, cinematic lighting, magical atmosphere, digital art style, detailed particle effects.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: prompt }],
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
}
