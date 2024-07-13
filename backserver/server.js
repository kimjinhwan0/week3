const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Express 앱 생성
const app = express();
app.use(express.json());

const secretKey = "your_secret_key"; // JWT 시크릿 키 설정

// MySQL 연결 설정
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Qlalfqjsgh1!', // 본인의 MySQL 패스워드로 변경
    database: 'week3' // week3 데이터베이스로 변경
});

// MySQL 연결
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ', err);
        return;
    }
    console.log('Connected to MySQL');
});

// 랜덤한 ID 생성 함수 (clientNumber 및 reviewID)
function generateRandomID(length) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// 회원 로그인 (login)
app.post('/user/login', (req, res) => {
    const { userID, userPW } = req.body;
    const query = 'SELECT * FROM Tab1 WHERE userID = ? AND userPW = ?';
    connection.query(query, [userID, userPW], (err, results) => {
        if (err) {
            console.error('Error fetching data: ', err);
            res.status(500).send('Error fetching data');
            return;
        }
        if (results.length > 0) {
            const token = jwt.sign({ userID }, secretKey, { expiresIn: '1h' });
            res.status(200).json({ jwtToken: token });
        } else {
            res.status(403).send('존재하지 않는 유저');
        }
    });
});

// 회원 가입 (Account)
app.post('/user/account', (req, res) => {
    const { userID, userPW, userName } = req.body;
    const clientNumber = generateRandomID(12);
    const jwtToken = jwt.sign({ userID }, secretKey, { expiresIn: '1h' });
    const query = 'INSERT INTO Tab1 (userID, userPW, userName, clientNumber, jwtToken) VALUES (?, ?, ?, ?, ?)';
    connection.query(query, [userID, userPW, userName, clientNumber, jwtToken], (err, results) => {
        if (err) {
            console.error('Error inserting data: ', err);
            res.status(400).send('입력 자체가 잘못됨');
            return;
        }
        res.status(200).json({ JWT: jwtToken });
    });
});

// 회원 자동 로그인 검증 (JWT 토큰 사용)
app.post('/user/jwt', (req, res) => {
    const { jwtToken } = req.body;
    jwt.verify(jwtToken, secretKey, (err, decoded) => {
        if (err) {
            res.status(403).send('존재하지 않는 유저');
            return;
        }
        res.status(200).send('OK');
    });
});

// 날짜 메뉴 정보 얻어오기 (GET /menu/getmenu)
app.get('/menu/getmenu', (req, res) => {
    const { date } = req.query; // GET 요청에서는 req.query를 사용
    const query = 'SELECT time, place, foodName FROM Tab2 WHERE date = ?';
    connection.query(query, [date], (err, results) => {
        if (err) {
            console.error('Error fetching data: ', err);
            res.status(500).send('Error fetching data');
            return;
        }
        if (results.length > 0) {
            res.status(200).json(results);
        } else {
            res.status(403).send('리뷰가 없음');
        }
    });
});

// 리뷰 쓰기 (POST /review/write)
app.post('/review/write', (req, res) => {
    const { foodName, userID, starRating, content } = req.body;
    const reviewID = generateRandomID(10);

    // 기존 리뷰 삭제
    const deleteQuery = 'DELETE FROM Tab4 WHERE foodName = ? AND userID = ?';
    connection.query(deleteQuery, [foodName, userID], (err, results) => {
        if (err) {
            console.error('Error deleting existing review: ', err);
            res.status(500).send('Error deleting existing review');
            return;
        }

        // 새로운 리뷰 추가
        const insertQuery = 'INSERT INTO Tab4 (reviewID, userID, content, starRating, foodName) VALUES (?, ?, ?, ?, ?)';
        connection.query(insertQuery, [reviewID, userID, content, starRating, foodName], (err, results) => {
            if (err) {
                console.error('Error inserting data: ', err);
                res.status(400).send('입력 자체가 잘못됨');
                return;
            }
            res.status(200).send('리뷰가 성공적으로 추가되었습니다');
        });
    });
});

// 서버 시작
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});




// const express = require('express');
// const mysql = require('mysql2');

// // Express 앱 생성
// const app = express();
// app.use(express.json());

// // MySQL 연결 설정
// const connection = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: 'Qlalfqjsgh1!', // 본인의 MySQL 패스워드로 변경
//     database: 'week3' // week3 데이터베이스로 변경
// });

// // MySQL 연결
// connection.connect((err) => {
//     if (err) {
//         console.error('Error connecting to MySQL: ', err);
//         return;
//     }
//     console.log('Connected to MySQL');
// });

// // Tab1 데이터 추가 (INSERT)
// app.post('/tab1', (req, res) => {
//     const { userName, userID, userPW, clientNumber, jwtToken } = req.body;
//     const query = 'INSERT INTO Tab1 (userName, userID, userPW, clientNumber, jwtToken) VALUES (?, ?, ?, ?, ?)';
//     connection.query(query, [userName, userID, userPW, clientNumber, jwtToken], (err, results) => {
//         if (err) {
//             console.error('Error inserting data: ', err);
//             res.status(500).send('Error inserting data');
//             return;
//         }
//         res.status(201).send('Data added successfully');
//     });
// });

// // Tab1 데이터 가져오기 (SELECT)
// app.get('/tab1', (req, res) => {
//     const query = 'SELECT * FROM Tab1';
//     connection.query(query, (err, results) => {
//         if (err) {
//             console.error('Error fetching data: ', err);
//             res.status(500).send('Error fetching data');
//             return;
//         }
//         res.status(200).json(results);
//     });
// });

// // Tab2 데이터 추가 (INSERT)
// app.post('/tab2', (req, res) => {
//     const { place, date, time, foodName } = req.body;
//     const query = 'INSERT INTO Tab2 (place, date, time, foodName) VALUES (?, ?, ?, ?)';
//     connection.query(query, [place, date, time, foodName], (err, results) => {
//         if (err) {
//             console.error('Error inserting data: ', err);
//             res.status(500).send('Error inserting data');
//             return;
//         }
//         res.status(201).send('Data added successfully');
//     });
// });

// // Tab2 데이터 가져오기 (SELECT)
// app.get('/tab2', (req, res) => {
//     const query = 'SELECT * FROM Tab2';
//     connection.query(query, (err, results) => {
//         if (err) {
//             console.error('Error fetching data: ', err);
//             res.status(500).send('Error fetching data');
//             return;
//         }
//         res.status(200).json(results);
//     });
// });

// // Tab3 데이터 추가 (INSERT)
// app.post('/tab3', (req, res) => {
//     const { foodName, allergy, foodImage } = req.body;
//     const query = 'INSERT INTO Tab3 (foodName, allergy, foodImage) VALUES (?, ?, ?)';
//     connection.query(query, [foodName, allergy, foodImage], (err, results) => {
//         if (err) {
//             console.error('Error inserting data: ', err);
//             res.status(500).send('Error inserting data');
//             return;
//         }
//         res.status(201).send('Data added successfully');
//     });
// });

// // Tab3 데이터 가져오기 (SELECT)
// app.get('/tab3', (req, res) => {
//     const query = 'SELECT * FROM Tab3';
//     connection.query(query, (err, results) => {
//         if (err) {
//             console.error('Error fetching data: ', err);
//             res.status(500).send('Error fetching data');
//             return;
//         }
//         res.status(200).json(results);
//     });
// });

// // Tab4 데이터 추가 (INSERT)
// app.post('/tab4', (req, res) => {
//     const { reviewID, clientNumber, review, starRating, foodName } = req.body;
//     const query = 'INSERT INTO Tab4 (reviewID, clientNumber, review, starRating, foodName) VALUES (?, ?, ?, ?, ?)';
//     connection.query(query, [reviewID, clientNumber, review, starRating, foodName], (err, results) => {
//         if (err) {
//             console.error('Error inserting data: ', err);
//             res.status(500).send('Error inserting data');
//             return;
//         }
//         res.status(201).send('Data added successfully');
//     });
// });

// // Tab4 데이터 가져오기 (SELECT)
// app.get('/tab4', (req, res) => {
//     const query = 'SELECT * FROM Tab4';
//     connection.query(query, (err, results) => {
//         if (err) {
//             console.error('Error fetching data: ', err);
//             res.status(500).send('Error fetching data');
//             return;
//         }
//         res.status(200).json(results);
//     });
// });

// // 서버 시작
// const port = 3000;
// app.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });
