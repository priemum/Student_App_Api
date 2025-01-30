const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const User = require("../models/User");
const VisaApplication = require("../models/VisaApplication");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads")); // Define your file upload directory
  },
  filename: (req, file, cb) => {  
    cb(null, Date.now() + path.extname(file.originalname)); // Generate a unique filename
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images and PDFs are allowed!"));
  },
});

// Route to render the student dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch user's visa applications from the database
    const visaApplications = await VisaApplication.find({ user: userId });

    // Calculate pending, completed, and other details based on application status
    const pending_count = visaApplications.filter(app => app.status === "pending").length;
    const completed_count = visaApplications.filter(app => app.status === "completed").length;
    const today_assignments = visaApplications.filter(app => {
      const today = new Date().toISOString().split("T")[0];
      const dueDate = app.collectionDate ? app.collectionDate.toISOString().split("T")[0] : null;
      return dueDate === today;
    }).length;

    res.render("student/dashboard", {
      user: req.user,
      visaApplications, // Pass applications to the frontend
      pending_count,
      completed_count,
      today_assignments,
      payments_sum: 1500.0, // Placeholder value
      assignment_count: visaApplications.length, // Total applications count
      title: "Dashboard",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error: " + error);
  }
});

// Route to render the form for adding a new visa application
router.get("/add-application", async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users
    res.render("student/add-application", { 
      title: "Apply for a Visa",
      application: null, // Pass `null` for new applications
      users  // Pass users to the EJS view
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route to handle adding a new visa application
router.post(
  "/add-application",
  upload.fields([
    { name: "passportDocument", maxCount: 1 },
    { name: "financialProof", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, dateOfBirth, nationality, passportNumber } = req.body;
      const passportDocument = req.files["passportDocument"]
        ? req.files["passportDocument"][0].path
        : null;
      const financialProof = req.files["financialProof"]
        ? req.files["financialProof"][0].path
        : null;

      const newApplication = new VisaApplication({
        user: req.user._id, // Assuming the user is logged in and available via req.user
        name,
        dateOfBirth,
        nationality,
        passportNumber,
        passportDocument,
        financialProof,
      });
      await newApplication.save();
      res.redirect("/student/dashboard");
      res.redirect("student/dashboard")
    } catch (err) {
      console.error("Error adding visa application:", err);
      res.status(500).render("error", { message: "There was a problem processing your application." });
    }
  }
);

// Route to render the document upload page
router.get("/upload", (req, res) => {
  res.render("student/upload", { title: "Upload Documents" });
});

// Route to handle document upload (linked to a session for storing documents)
router.post("/upload", (req, res) => {
  if (!req.session.user.documents) {
    req.session.user.documents = [];
  }
  const document = req.body.document;
  req.session.user.documents.push(document);
  res.redirect("/student/dashboard");
});

// Route to handle logging out
router.get("/logout", (req, res) => {
  req.logout(); // End the session for the logged-in user
  res.redirect("/");
});

module.exports = router;
