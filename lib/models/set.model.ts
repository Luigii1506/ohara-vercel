import mongoose from 'mongoose';

const setSchema = new mongoose.Schema({
    image: { type: String, required: true },
    title: { type: String, required: true },
    code: { type: String },
    releaseDate: { type: Date, required: true },
    isOpen: { type: Boolean, default: false, required: true },
}, { timestamps: true });

const Set = mongoose.models.Set || mongoose.model('Set', setSchema);

export default Set;
