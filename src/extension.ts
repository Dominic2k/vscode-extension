import * as vscode from "vscode";
import * as path from "path";
import dotenv from "dotenv";

/**
 * Gemini API response type (MVP)
 */
type GeminiResponse = any;

/**
 * Call Gemini API to explain code
 */
async function callGemini(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
        throw new Error(
            "Missing GEMINI_API_KEY. Add it to .env in the extension project root."
        );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [
            {
                parts: [{ text: prompt }],
            },
        ],
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${errText}`);
    }

    const data: GeminiResponse = await res.json();

    const text =
        data?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p.text)
            .join("") || "";

    return text.trim() || "(No content returned)";
}

/**
 * Extension entry point
 */
export function activate(context: vscode.ExtensionContext) {
    /**
     * Load .env from EXTENSION ROOT
     * (same level as package.json)
     */
    const envPath = path.join(context.extensionPath, ".env");
    dotenv.config({ path: envPath });

    console.log("Gemini extension activated");
    console.log("Loaded .env from:", envPath);
    console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);

    const output = vscode.window.createOutputChannel("Gemini Explain");

    const disposable = vscode.commands.registerCommand(
        "geminiExplain.explainSelection",
        async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage("No active editor found.");
                    return;
                }

                const selection = editor.selection;
                const selectedText = editor.document.getText(selection).trim();

                if (!selectedText) {
                    vscode.window.showWarningMessage(
                        "Please select some code to explain."
                    );
                    return;
                }

                const lang = editor.document.languageId;

                const prompt = `
Bạn là trợ lý giải thích code cho sinh viên.
Giải thích đoạn code sau bằng tiếng Việt, ngắn gọn, dễ hiểu:
- Mô tả mục đích đoạn code
- Giải thích từng bước chính
- Nếu có rủi ro/bug tiềm ẩn thì nêu 1-2 ý
- Nếu có thể, đề xuất 1 cải thiện nhỏ

Ngôn ngữ: ${lang}

CODE:
\`\`\`
${selectedText}
\`\`\`
`.trim();

                output.clear();
                output.show(true);
                output.appendLine("=== Gemini Explain ===");
                output.appendLine(`Language: ${lang}`);
                output.appendLine("");

                const answer = await callGemini(prompt);

                output.appendLine(answer);
                output.appendLine("\n---\n");

                await vscode.env.clipboard.writeText(answer);
                vscode.window.showInformationMessage(
                    "Explained! (Copied to clipboard)"
                );
            } catch (err: any) {
                vscode.window.showErrorMessage(err?.message ?? String(err));
            }
        }
    );

    context.subscriptions.push(disposable, output);
}

/**
 * Extension cleanup
 */
export function deactivate() {
    console.log("Gemini extension deactivated");
}
