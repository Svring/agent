"use client";

import { useState, FormEvent } from "react";

export default function GalleryPage() {
  const [prompt, setPrompt] = useState("");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log("Form submitted with prompt:", prompt);
    if (!prompt.trim()) {
      console.log("Prompt is empty, exiting.");
      return;
    }

    console.log("Setting loading state to true.");
    setLoading(true);
    setImgSrc(null);
    try {
      console.log("Sending request to /api/image");
      const res = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      console.log("Received response from /api/image", res);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API request failed with status:", res.status, "and text:", errorText);
        throw new Error(errorText);
      }

      console.log("Parsing response JSON.");
      const data = await res.json();
      console.log("API Response Data:", data);

      if (data?.image?.base64Data) {
        console.log("Setting image source.");
        setImgSrc(`data:image/png;base64,${data.image.base64Data}`);
      } else {
        console.log("No base64Data found in response data.");
      }
    } catch (err) {
      console.error("Caught error during image generation:", err);
    } finally {
      console.log("Setting loading state to false.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col w-full h-full items-center gap-4 p-4">
      <form onSubmit={handleSubmit} className="flex w-full h-full max-w-xl gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe an image..."
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {imgSrc && (
        <img
          src={imgSrc}
          alt={prompt}
          className="max-w-full rounded shadow-lg"
        />
      )}
    </main>
  );
}
