import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema({
    src: { type: String, required: true },
    name: { type: String, required: true },
    types: [{ type: String }],
    colors: [{ type: String }],
    cost: { type: String, default: null },
    power: { type: String, default: null },
    attribute: { type: String, default: null },
    counter: { type: String, default: null },
    category: { type: String, required: true },
    life: { type: String, default: null },
    rarity: { type: String },
    set: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Set' }],
    illustrator: { type: String, default: null },
    alternateArt: { type: String, default: null },
    status: { type: String },
    trigger: { type: String, default: null },
    effects: [{ type: String }],
    texts: [{ type: String }],
    code: { type: String, required: true },
    setCode: { type: String, required: true },
    isFirstEdition: { type: Boolean, required: true },
}, { timestamps: true });

const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

export default Card;
