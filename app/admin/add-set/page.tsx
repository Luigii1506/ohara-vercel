"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";

const AddSet = () => {
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [code, setCode] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title || !releaseDate) {
      showErrorToast("Title, image, and release date are required.");
      return;
    }

    try {
      const res = await fetch("/api/admin/sets", {
        method: "POST",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify({
          image: image ?? "",
          title,
          releaseDate,
          code,
          isOpen,
        }),
      });

      if (res.ok) {
        showSuccessToast("Set created successfully");
      } else {
        showErrorToast("Failed to create a set");
        throw new Error("Failed to create a set");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setImage("");
      setTitle("");
      setReleaseDate("");
      setCode("");
      setIsOpen(false);
      setDate(undefined);
    }
  };

  // Update the releaseDate state when the date changes
  const handleDateChange = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      setReleaseDate(format(selectedDate, "yyyy-MM-dd"));
    } else {
      setReleaseDate("");
    }
  };

  return (
    <div className="flex justify-center items-center flex-1 p-4 w-full">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Add New Set
          </CardTitle>
          <CardDescription className="text-center">
            Enter the details for the new set
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image">Image URL (Optional)</Label>
              <Input
                id="image"
                onChange={(e) => setImage(e.target.value)}
                value={image}
                placeholder="Enter image URL"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title (*)</Label>
              <Input
                id="title"
                onChange={(e) => setTitle(e.target.value)}
                value={title}
                placeholder="Enter title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Code (Optional)</Label>
              <Input
                id="code"
                onChange={(e) => setCode(e.target.value)}
                value={code}
                placeholder="Enter code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="releaseDate">Release Date (*)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <input
                type="hidden"
                value={releaseDate}
                name="releaseDate"
                required
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="isOpen"
                checked={isOpen}
                onCheckedChange={setIsOpen}
              />
              <Label htmlFor="isOpen">Is Open</Label>
            </div>

            <Button type="submit" className="w-full">
              Add Set
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="mt-2"
          >
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AddSet;
