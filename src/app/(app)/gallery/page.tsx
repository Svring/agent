"use client";

import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

export default function GalleryPage() {
  const [prompt, setPrompt] = useState("");
  const [imgSrcs, setImgSrcs] = useState<string[]>([]);
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
    try {
      console.log("Sending request to /api/gallery");
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      console.log("Received response from /api/gallery", res);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API request failed with status:", res.status, "and text:", errorText);
        throw new Error(errorText);
      }

      console.log("Parsing response JSON.");
      const data = await res.json();
      console.log("API Response Data:", data);

      if (data?.image?.base64Data) {
        const newImgSrc = `data:image/png;base64,${data.image.base64Data}`;
        console.log("Adding new image source to the list.");
        setImgSrcs((prevSrcs) => [...prevSrcs, newImgSrc]);
      } else {
        console.log("No base64Data found in response data.");
      }
    } catch (err) {
      console.error("Caught error during gallery generation:", err);
    } finally {
      console.log("Setting loading state to false.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col w-full items-center gap-4 p-4">
      <form onSubmit={handleSubmit} className="flex w-full h-full max-w-xl gap-2">
        <Input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe an image..."
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate"}
        </Button>
      </form>

      {imgSrcs.length > 0 && (
        <Carousel className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl">
          <CarouselContent>
            {imgSrcs.map((src, index) => (
              <CarouselItem key={index}>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex aspect-square items-center justify-center p-6">
                      <img
                        src={src}
                        alt={`Generated image ${index + 1}`}
                        className="max-w-full max-h-full rounded object-contain"
                      />
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      )}
    </main>
  );
}
