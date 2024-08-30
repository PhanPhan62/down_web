const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Đọc dữ liệu từ tệp JSON
function loadVideoOptions() {
    const filePath = path.join(__dirname, 'videos.json');
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(JSON.parse(data));
        });
    });
}

// Tạo thư mục lưu trữ video nếu không tồn tại
async function createDirectory(folderName) {
    const dirPath = path.join(__dirname, `videos/${folderName}`);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
}

// Tải video từ URL và lưu vào thư mục
async function downloadVideo(url, fileName, folderPath) {
    // Đảm bảo tên tệp có phần mở rộng .mp4
    if (!fileName.endsWith('.mp4')) {
        fileName += '.mp4';
    }

    const filePath = path.join(folderPath, fileName);
    const writer = fs.createWriteStream(filePath);

    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        // Xác định loại nội dung để đảm bảo rằng phản hồi là video
        const contentType = response.headers['content-type'];
        if (!contentType.includes('video/mp4')) {
            console.warn(`Warning: ${fileName} may not be an MP4 file (Content-Type: ${contentType})`);
        }

        console.log(`\n=======>Downloading ${fileName}`);

        const progress = new Promise((resolve, reject) => {
            const totalLength = response.headers['content-length'];
            let downloadedLength = 0;

            response.data.on('data', chunk => {
                downloadedLength += chunk.length;
                const percentage = (downloadedLength / totalLength * 100).toFixed(2);
                process.stdout.write(`\rDownloading ${fileName}: ${percentage}%`);
            });

            response.data.pipe(writer);

            writer.on('finish', () => {
                console.log(`\nDownloaded ${fileName} successfully.\n############################################################`);
                resolve();
            });

            writer.on('error', (error) => {
                console.error(`Error downloading ${fileName}:`, error.message);
                reject(error);
            });
        });

        return progress;
    } catch (error) {
        console.error('Error in downloadVideo:', error.message);
        throw error;
    }
}

// Hàm để tải tất cả video
async function downloadAllVideos() {
    try {
        const videoOptions = await loadVideoOptions();
        let totalVideos = 0;
        let completedVideos = 0;

        // Đếm tổng số video
        videoOptions.forEach(parent => {
            parent.folder_chidls.forEach(child => {
                totalVideos += child.videos.length;
            });
        });

        for (const parent of videoOptions) {
            const parentFolderPath = await createDirectory(parent.name);

            for (const { folderName, videos } of parent.folder_chidls) {
                const folderPath = await createDirectory(path.join(parent.name, folderName));

                for (const video of videos) {
                    const { path: url, title } = video;
                    await downloadVideo(url, title.trim(), folderPath);
                    completedVideos++;
                    const percentage = ((completedVideos / totalVideos) * 100).toFixed(2);
                    process.stdout.write(`\rOverall progress: ${percentage}% (${completedVideos}/${totalVideos})`);
                }
            }
        }
        console.log('\nAll videos downloaded successfully!');
    } catch (error) {
        console.error('Error downloading videos:', error.message);
    }
}

// Route để bắt đầu tải video
// app.get('/', (req, res) => {
//     downloadAllVideos()
//         .then(() => res.send("Tất cả video đã được tải xuống thành công"))
//         .catch(error => res.status(500).send(`Lỗi khi tải video: ${error.message}`));
// });

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    downloadAllVideos()
        .then(() => console.log("Tất cả video đã được tải xuống thành công"))
        .catch(error => console.log(`Lỗi khi tải video: ${error.message}`));
});
