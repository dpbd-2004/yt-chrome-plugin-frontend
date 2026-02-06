// popup.js

document.addEventListener("DOMContentLoaded", async () => {
  const outputDiv = document.getElementById("output");
  const API_KEY = "AIzaSyDNSuSueeP5djya8vrfhka7Ec6NNYW_WrQ";
  const API_URL = "http://localhost:5000";

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

      // Call the API
      const predictions = await getSentimentPredictions(comments);

      if (predictions && predictions.length > 0) {
        const sentimentCounts = { 1: 0, 0: 0, "-1": 0 };
        const sentimentData = [];
        let totalSentimentScore = 0;

        predictions.forEach((item) => {
          // Ensure we treat the sentiment as a string for the key
          const sKey = String(item.sentiment);
          if (sentimentCounts.hasOwnProperty(sKey)) {
            sentimentCounts[sKey]++;
          }

          const sVal = parseInt(item.sentiment);
          totalSentimentScore += sVal;

          sentimentData.push({
            timestamp: item.timestamp,
            sentiment: sVal,
          });
        });

        // Metrics Calculation
        const totalComments = comments.length;
        const uniqueCommenters = new Set(comments.map((c) => c.authorId)).size;
        const totalWords = comments.reduce(
          (sum, c) => sum + c.text.split(/\s+/).length,
          0,
        );
        const avgWordLength = (totalWords / totalComments).toFixed(2);

        // Normalize Score: (-1 to 1) -> (0 to 10)
        const avgSentimentScore = totalSentimentScore / totalComments;
        const normalizedScore = (((avgSentimentScore + 1) / 2) * 10).toFixed(2);

        // UI Update: Summary
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Comment Analysis Summary</div>
            <div class="metrics-container">
              <div class="metric"><div class="metric-title">Total Comments</div><div class="metric-value">${totalComments}</div></div>
              <div class="metric"><div class="metric-title">Unique Commenters</div><div class="metric-value">${uniqueCommenters}</div></div>
              <div class="metric"><div class="metric-title">Avg Length</div><div class="metric-value">${avgWordLength} words</div></div>
              <div class="metric"><div class="metric-title">Sentiment Score</div><div class="metric-value">${normalizedScore}/10</div></div>
            </div>
          </div>
        `;

        // UI Update: Placeholders for Images
        outputDiv.innerHTML += `
          <div class="section"><div class="section-title">Sentiment Distribution</div><div id="chart-container"></div></div>
          <div class="section"><div class="section-title">Trend Over Time</div><div id="trend-graph-container"></div></div>
          <div class="section"><div class="section-title">Word Cloud</div><div id="wordcloud-container"></div></div>
        `;

        // Trigger Image Fetches
        await Promise.all([
          fetchAndDisplayChart(sentimentCounts),
          fetchAndDisplayTrendGraph(sentimentData),
          fetchAndDisplayWordCloud(comments.map((c) => c.text)),
        ]);

        // UI Update: Comments List
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Recent Comments</div>
            <ul class="comment-list">
              ${predictions
                .slice(0, 15)
                .map(
                  (item, idx) => `
                <li class="comment-item">
                  <strong>${idx + 1}.</strong> ${item.comment.substring(0, 100)}...<br>
                  <span class="comment-sentiment">Sentiment: ${item.sentiment}</span>
                </li>`,
                )
                .join("")}
            </ul>
          </div>`;
      }
    } else {
      outputDiv.innerHTML = "<p>Please open a YouTube video to analyze.</p>";
    }
  });

  // --- Helper Functions ---

  async function fetchComments(videoId) {
    let comments = [];
    let pageToken = "";
    try {
      // Limit to 200 for faster processing during testing
      while (comments.length < 200) {
        const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&pageToken=${pageToken}&key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.items) break;

        data.items.forEach((item) => {
          const snippet = item.snippet.topLevelComment.snippet;
          comments.push({
            text: snippet.textOriginal,
            timestamp: snippet.publishedAt,
            authorId: snippet.authorChannelId?.value || "Unknown",
          });
        });
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    } catch (e) {
      console.error("YT API Error:", e);
    }
    return comments;
  }

  async function getSentimentPredictions(comments) {
    try {
      const response = await fetch(`${API_URL}/predict_with_timestamps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      });
      if (!response.ok) throw new Error(await response.text());
      return await response.json();
    } catch (e) {
      outputDiv.innerHTML += `<p style="color:red">Prediction Error: ${e.message}</p>`;
      return null;
    }
  }

  async function fetchAndDisplayChart(counts) {
    const response = await fetch(`${API_URL}/generate_chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_counts: counts }),
    });
    if (response.ok) displayImage(await response.blob(), "chart-container");
  }

  async function fetchAndDisplayTrendGraph(data) {
    const response = await fetch(`${API_URL}/generate_trend_graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_data: data }),
    });
    if (response.ok)
      displayImage(await response.blob(), "trend-graph-container");
  }

  async function fetchAndDisplayWordCloud(texts) {
    const response = await fetch(`${API_URL}/generate_wordcloud`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: texts }),
    });
    if (response.ok) displayImage(await response.blob(), "wordcloud-container");
  }

  function displayImage(blob, containerId) {
    const imgURL = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgURL;
    img.style.width = "100%";
    document.getElementById(containerId).appendChild(img);
  }
});
