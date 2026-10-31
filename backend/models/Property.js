const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 90,
    },
    type: {
      type: String,
      enum: ["sale", "rent"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePeriod: {
      type: String,
      enum: ["year", "month", null],
      default: null,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ["Apartment", "House", "Penthouse", "Duplex", "Terrace"],
      required: true,
    },
    beds: {
      type: Number,
      required: true,
      min: 0,
    },
    baths: {
      type: Number,
      required: true,
      min: 0,
    },
    area: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    features: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    availability: {
      type: String,
      enum: ["available", "under-offer", "let-agreed"],
      default: "available",
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "properties",
  },
);

module.exports = mongoose.model("Property", propertySchema);
