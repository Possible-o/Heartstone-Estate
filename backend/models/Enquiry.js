
"use strict";

const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 25
    },
    interest: {
      type: String,
      required: true,
      enum: [
        "Buying a property",
        "Selling a property",
        "Renting a property",
        "Letting a property",
        "Property valuation",
        "General enquiry"
      ]
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending"
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

enquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Enquiry", enquirySchema);
