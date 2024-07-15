const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

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

// 알레르기 코드 추출 함수
const extractAllergyCodes = (text) => {
    const regex = /\((\d+(?:,\d+)*)\)/;
    const match = regex.exec(text);
    return match ? match[1] : null;
};

// 크롤링 엔드포인트 (GET /menu/crawl)
app.get('/menu/crawl', async (req, res) => {
    const { place, date } = req.query;
    const validPlaces = ['fclt', 'west', 'east1', 'east2', 'emp', 'icc', 'hawam', 'seoul', 'fclt_cafe', 'east2_cafe', 'big_cafe', 'taeul_cafe'];

    if (!validPlaces.includes(place) || !date) {
        res.status(400).send('Invalid place or date');
        return;
    }

    const url = `https://www.kaist.ac.kr/kr/html/campus/053001.html?dvs_cd=${place}&stt_dt=${date}`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const dateHeader = $('#tab_item_1 > h3').text().trim();
        const breakfast = $('#tab_item_1 > table > tbody > tr > td:nth-child(1)').html().trim();
        const lunch = $('#tab_item_1 > table > tbody > tr > td:nth-child(2)').html().trim();
        const dinner = $('#tab_item_1 > table > tbody > tr > td:nth-child(3)').html().trim();

        const menu = {
            date: dateHeader,
            meals: {
                breakfast,
                lunch,
                dinner
            }
        };

        // MySQL에 데이터 저장
        const insertMenuData = (mealTime, mealData) => {
            const lines = mealData.split('<br>').map(line => line.trim()).filter(line => line);
            const mealPriceLine = lines[0];
            const mealItems = lines.slice(1).filter(line => !line.includes('</ul>') && !line.includes('<!--'));

            const insertTab5Query = 'INSERT INTO Tab5 (date, place, time, menuprice) VALUES (?, ?, ?, ?)';
            connection.query(insertTab5Query, [date, place, mealTime, mealPriceLine], (err, result) => {
                if (err) {
                    console.error('Error inserting data into Tab5: ', err);
                } else {
                    console.log('Inserted data into Tab5');
                }
            });

            mealItems.forEach(item => {
                const allergy = extractAllergyCodes(item);
                const foodName = item.replace(/\(.*?\)/g, '').trim();

                // Tab2에 데이터 삽입
                const insertTab2Query = 'INSERT INTO Tab2 (place, date, time, foodName) VALUES (?, ?, ?, ?)';
                connection.query(insertTab2Query, [place, date, mealTime, foodName], (err, result) => {
                    if (err) {
                        console.error('Error inserting data into Tab2: ', err);
                    } else {
                        console.log('Inserted data into Tab2');
                    }
                });

                // Tab3에 데이터 삽입 (이미 존재하는 경우 중복 삽입 방지)
                const insertTab3Query = 'INSERT INTO Tab3 (foodName, allergy, foodImage) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE allergy = VALUES(allergy)';
                connection.query(insertTab3Query, [foodName, allergy, null], (err, result) => {
                    if (err) {
                        console.error('Error inserting data into Tab3: ', err);
                    } else {
                        console.log('Inserted data into Tab3');
                    }
                });
            });
        };

        insertMenuData(1, breakfast);
        insertMenuData(2, lunch);
        insertMenuData(3, dinner);

        res.status(200).json(menu);

    } catch (error) {
        console.error('Error fetching data: ', error);
        res.status(500).send('Error fetching data');
    }
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
