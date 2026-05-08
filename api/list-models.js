module.exports = async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  });
  const data = await response.json();
  return res.status(200).json(data);
};
