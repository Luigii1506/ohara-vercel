"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const EditTopic = ({ params }: { params: { id: string } }) => {
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [code, setCode] = useState("");
  const [isEvent, setIsEvent] = useState(false);
  const router = useRouter();
  const { id } = params;

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toISOString().split("T")[0]; // Extract YYYY-MM-DD from ISO string
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title || !image || !releaseDate || !code) {
      alert("Title, image, and release date are required.");
      return;
    }

    try {
      const res = await fetch(`/api/sets/${id}`, {
        method: "PUT",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify({ image, title, releaseDate, code, isEvent }),
      });

      if (res.ok) {
        router.refresh();
        router.push("/");
      } else {
        throw new Error("Failed to update a set");
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const fetchSets = async () => {
      try {
        const res = await fetch(`/api/sets/${id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }

        const data = await res.json();

        setImage(data.set.image);
        setTitle(data.set.title);

        setCode(data.set.code);
        setReleaseDate(formatDate(data.set.releaseDate));
        setIsEvent(data.set.isEvent);
      } catch (error) {
        console.error(error);
      }
    };

    fetchSets();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        onChange={(e) => setImage(e.target.value)}
        value={image}
        className="border border-slate-500 px-8 py-2"
        type="text"
        placeholder="Image URL"
      />

      <input
        onChange={(e) => setTitle(e.target.value)}
        value={title}
        className="border border-slate-500 px-8 py-2"
        type="text"
        placeholder="Title"
      />

      <input
        onChange={(e) => setCode(e.target.value)}
        value={code}
        className="border border-slate-500 px-8 py-2"
        type="text"
        placeholder="Code"
      />

      <input
        onChange={(e) => setReleaseDate(e.target.value)}
        value={releaseDate}
        className="border border-slate-500 px-8 py-2"
        type="date"
        placeholder="Release Date"
      />

      <label>
        <input
          type="checkbox"
          checked={isEvent}
          onChange={(e) => setIsEvent(e.target.checked)}
        />
        Is Event
      </label>

      <button
        type="submit"
        className="bg-green-600 font-bold text-white py-3 px-6 w-fit"
      >
        Edit Set
      </button>
    </form>
  );
};

export default EditTopic;
