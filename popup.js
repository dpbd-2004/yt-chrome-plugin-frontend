// popup.js

document.addEventListener("DOMContentLoaded", async () => {
  const outputDiv = document.getElementById("output");
  const API_KEY = "";

  // Get the current tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const url = tabs[0].url;
    const youtubeRegex =
      /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
      const videoId = match[1];
      outputDiv.innerHTML = `<div class="section-title">YouTube Video ID</div><p>${videoId}</p><p>Fetching comments...</p>`;

      const comments = await fetchComments(videoId);
      if (comments.length === 0) {
        outputDiv.innerHTML += "<p>No comments found for this video.</p>";
        return;
      }

      outputDiv.innerHTML += `<p>Fetched ${comments.length} comments. Performing sentiment analysis...</p>`;
      const predictions = await getSentimentPredictions(comments);

      if (predictions) {
        const sentimentCounts = { 1: 0, 0: 0, "-1": 0 };
        const sentimentData = [];
        const totalSentimentScore = predictions.reduce(
          (sum, item) => sum + parseInt(item.sentiment),
          0,
        );

        predictions.forEach((item) => {
          sentimentCounts[item.sentiment]++;
          sentimentData.push({
            timestamp: item.timestamp,
            sentiment: parseInt(item.sentiment),
          });
        });

        const totalComments = comments.length;
        const uniqueCommenters = new Set(
          comments.map((comment) => comment.authorId),
        ).size;
        const totalWords = comments.reduce(
          (sum, comment) =>
            sum +
            comment.text.split(/\s+/).filter((word) => word.length > 0).length,
          0,
        );
        const avgWordLength = (totalWords / totalComments).toFixed(2);
        const avgSentimentScore = (totalSentimentScore / totalComments).toFixed(
          2,
        );
        const normalizedSentimentScore = (
          ((parseFloat(avgSentimentScore) + 1) / 2) *
          10
        ).toFixed(2);

        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Comment Analysis Summary</div>
            <div class="metrics-container">
              <div class="metric">
                <div class="metric-title">Total Comments</div>
                <div class="metric-value">${totalComments}</div>
              </div>
              <div class="metric">
                <div class="metric-title">Unique Commenters</div>
                <div class="metric-value">${uniqueCommenters}</div>
              </div>
              <div class="metric">
                <div class="metric-title">Avg Comment Length</div>
                <div class="metric-value">${avgWordLength} words</div>
              </div>
              <div class="metric">
                <div class="metric-title">Avg Sentiment Score</div>
                <div class="metric-value">${normalizedSentimentScore}/10</div>
              </div>
            </div>
          </div>
        `;

        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Sentiment Analysis Results</div>
            <div id="chart-container"></div>
          </div>
          <div class="section">
            <div class="section-title">Sentiment Trend Over Time</div>
            <div id="trend-graph-container"></div>
          </div>
          <div class="section">
            <div class="section-title">Comment Wordcloud</div>
            <div id="wordcloud-container"></div>
          </div>
          <div class="section">
            <div class="section-title">Top 25 Comments</div>
            <ul class="comment-list">
              ${predictions
                .slice(0, 25)
                .map(
                  (item, index) => `
                <li class="comment-item">
                  <span>${index + 1}. ${item.comment}</span><br>
                  <span class="comment-sentiment">Sentiment: ${item.sentiment}</span>
                </li>`,
                )
                .join("")}
            </ul>
          </div>`;

        // Execute visual displays
        await fetchAndDisplayChart(sentimentCounts);
        await fetchAndDisplayTrendGraph(sentimentData);
        await fetchAndDisplayWordCloud(comments.map((c) => c.text));
      }
    } else {
      outputDiv.innerHTML = "<p>This is not a valid YouTube URL.</p>";
    }
  });

  // --- Helper Functions ---

  async function fetchComments(videoId) {
    let comments = [];
    let pageToken = "";
    try {
      while (comments.length < 500) {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&pageToken=${pageToken}&key=${API_KEY}`,
        );
        const data = await response.json();
        if (data.items) {
          data.items.forEach((item) => {
            const snippet = item.snippet.topLevelComment.snippet;
            comments.push({
              text: snippet.textOriginal,
              timestamp: snippet.publishedAt,
              authorId: snippet.authorChannelId?.value || "Unknown",
            });
          });
        }
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
    return comments;
  }

  async function getSentimentPredictions(comments) {
    try {
      const response = await fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: comments.map((c) => c.text) }),
      });
      const results = await response.json();
      // Map the backend predictions back to the comment objects with timestamps
      return results.map((res, i) => ({
        comment: res.comment,
        sentiment: res.sentiment,
        timestamp: comments[i].timestamp,
      }));
    } catch (e) {
      console.error("Prediction failed", e);
      return null;
    }
  }

  // Placeholder functions for your visualization backend/library
  async function fetchAndDisplayChart(counts) {
    console.log("Displaying Pie Chart", counts);
  }
  async function fetchAndDisplayTrendGraph(data) {
    console.log("Displaying Trend", data);
  }
  async function fetchAndDisplayWordCloud(texts) {
    console.log("Displaying Wordcloud");
  }
});
