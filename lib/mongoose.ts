import mongoose from "mongoose";

let isConnected = false; // Controla si ya estamos conectados

export const connectToDB = async () => {
  mongoose.set("strictQuery", true); // Configuración de Mongoose para evitar advertencias

  if (!process.env.MONGODB_URI) {
    console.log("MONGODB_URI is not defined");
    throw new Error("MONGODB_URI not found"); // Lanzar un error para manejarlo a nivel superior
  }

  if (isConnected) {
    console.log("=> Using existing database connection");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI); // Sin opciones adicionales, ya son automáticas
    isConnected = true;
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error); // Información detallada del error
    throw new Error("Failed to connect to MongoDB"); // Lanzar error para que pueda ser capturado por quien lo llama
  }
};
