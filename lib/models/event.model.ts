import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Nombre del evento
    eventDate: { type: Date, required: true }, // Fecha del evento
    location: { type: String, required: true }, // Lugar del evento
    sets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Set' }], // Arreglo de sets referenciando al modelo Set
}, { timestamps: true }); // timestamps agrega campos createdAt y updatedAt automáticamente

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

export default Event;
