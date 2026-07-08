const express = require('express');
const router = express.Router();
const taskCategoryController = require('../controllers/taskCategoryController');
const taskController = require('../controllers/taskController');
const taskSubmissionController = require('../controllers/taskSubmissionController');

// নতুন ক্যাটাগরি অ্যাড করার এন্ডপয়েন্ট (POST)
router.post('/category/create', taskCategoryController.createCategory);

// সব ক্যাটাগরি লিস্ট দেখার এন্ডপয়েন্ট (GET)
// URL: http://localhost:3001/api/task/category/all
router.get('/category/all', taskCategoryController.getAllCategories);
// নতুন কাজ/টাস্ক তৈরি করার এন্ডপয়েন্ট (POST)
router.post('/create', taskController.createTask);

// অ্যাপে দেখানোর জন্য সব একটিভ টাস্কের লিস্ট (GET)
// URL: http://localhost:3001/api/task/active-list
router.get('/active-list', taskController.getActiveTasks);

// ১. ইউজারের কাজ সাবমিট করার রাউট (POST)
router.post('/submit', taskSubmissionController.submitTask);
// ২. অ্যাডমিনের কাজ অ্যাপ্রুভ বা রিজেক্ট করার রাউট (POST)
// URL: http://localhost:3001/api/task/review
router.post('/review', taskSubmissionController.reviewSubmission);

module.exports = router;