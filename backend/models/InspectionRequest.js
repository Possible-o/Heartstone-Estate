
const mongoose = require("mongoose");

const inspectionRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true
    },
    requester: {
      type: String,
      required: true,
      trim: true,
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
      required: true,
      trim: true,
      maxlength: 30
    },
    preferredDate: {
      type: String,
      required: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
      index: true
    },
    agreedDate: {
      type: String,
      default: null
    },
    agreedTime: {
      type: String,
      default: null
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    }
  },
  {
    timestamps: true,
    collection: "inspectionrequests"
  }
);

inspectionRequestSchema.index({
  user: 1,
  property: 1,
  preferredDate: 1,
  status: 1
});

module.exports = mongoose.model(
  "InspectionRequest",
  inspectionRequestSchema
);
