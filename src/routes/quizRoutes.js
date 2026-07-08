const express = require('express');
const router = express.Router();
const quizCategoryController = require('../controllers/quizCategoryController');
const quizController = require('../controllers/quizController');
const questionController = require('../controllers/questionController');

// নতুন কুইজ ক্যাটাগরি তৈরি করার রাউট (POST)
router.post('/category/create', quizCategoryController.createCategory);

// সব কুইজ ক্যাটাগরি লিস্ট দেখার রাউট (GET)
// URL: http://localhost:3001/api/quiz/category/all
router.get('/category/all', quizCategoryController.getAllCategories);
// নতুন কুইজ মিশন তৈরি করার রাউট (POST)
router.post('/create', quizController.createQuiz);

// কোনো নির্দিষ্ট ক্যাটাগরির সব একটিভ কুইজ দেখার রাউট (GET)
// URL: http://localhost:3001/api/quiz/category-list/১
router.get('/category-list/:category_id', quizController.getQuizzesByCategory);

// ১. কুইজে নতুন প্রশ্ন যুক্ত করার রাউট (POST)
router.post('/question/add', questionController.addQuestion);

// ২. কুইজ খেলার জন্য র‍্যান্ডম প্রশ্নের তালিকা নেওয়ার রাউট (GET)
// URL: http://localhost:3001/api/quiz/questions/তোমার_কুইজ_UUID
router.get('/questions/:quiz_id', questionController.getQuestionsByQuiz);

// কুইজের উত্তর সাবমিট করার এন্ডপয়েন্ট (POST)
// URL: http://localhost:3001/api/quiz/submit-answers
router.post('/submit-answers', quizController.submitQuizAnswers);

module.exports = router;