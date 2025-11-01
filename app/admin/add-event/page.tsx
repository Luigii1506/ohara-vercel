"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Set } from "@/types"; // Suponiendo que ya tienes el tipo Set definido

const AddEvent = () => {
  const [name, setName] = useState<string>("");
  const [date, setDate] = useState<Date | null>(null);
  const [location, setLocation] = useState<string>("");
  const [sets, setSets] = useState<Set[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]); // Para manejar los sets seleccionados
  const router = useRouter();

  // Función para manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name || !date || !location) {
      alert("Name, date, and location are required.");
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          date,
          location,
          sets: selectedSets,
        }),
      });

      if (res.ok) {
        router.push("/"); // Redirigir a la página principal u otra después de crear el evento
      } else {
        throw new Error("Failed to create event");
      }
    } catch (error) {
      console.error("Error:::", error);
    }
  };

  useEffect(() => {
    const fetchSets = async () => {
      try {
        const res = await fetch("/api/sets", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }

        const data = await res.json();
        setSets(data.sets);
      } catch (error) {
        console.error(error);
      }
    };

    fetchSets();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="name">Nombre del Evento</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del Evento"
          className="border border-slate-500 px-8 py-2"
          required
        />
      </div>

      <div>
        <label htmlFor="date">Fecha del Evento</label>
        <DatePicker
          selected={date}
          onChange={(date) => setDate(date)}
          dateFormat="dd/MM/yyyy"
          placeholderText="Seleccionar fecha"
          className="border border-slate-500 px-8 py-2"
          required
        />
      </div>

      <div>
        <label htmlFor="location">Lugar del Evento</label>
        <input
          type="text"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Lugar del Evento"
          className="border border-slate-500 px-8 py-2"
          required
        />
      </div>

      <div>
        <label htmlFor="sets">Sets</label>
        <Select
          id="sets"
          isMulti
          options={sets.map((set) => ({
            value: set.id,
            label: set.title,
          }))}
          onChange={(selectedOptions) =>
            setSelectedSets(
              selectedOptions
                .map((option) => option.value)
                .filter((value): value is string => value !== undefined) // Filtrar valores undefined
            )
          }
          placeholder="Seleccionar sets"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 font-bold text-white py-3 px-6 w-fit"
      >
        Crear Evento
      </button>
    </form>
  );
};

export default AddEvent;
