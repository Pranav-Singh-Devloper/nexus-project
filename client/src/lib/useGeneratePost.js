import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';

// Turns a research report into a LinkedIn draft and opens it in the composer.
export function useGeneratePost() {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generate = async (project) => {
    if (generating || !project?.report) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/generate-linkedin-post`, { content: project.report }, { withCredentials: true });
      const tags = (res.data.hashtags || []).filter(Boolean);
      const html = tags.length ? `${res.data.post_html}<p>${tags.join(' ')}</p>` : res.data.post_html;

      // Save it as a draft (linked to this research) and open it in the composer
      const draft = await axios.post(`${API_URL}/api/drafts`, {
        html,
        hashtags: tags,
        imagePrompt: res.data.image_prompt || null,
        imageStyle: res.data.image_style || 'square',
        projectId: project.id,
      }, { withCredentials: true });
      navigate(`/compose?draft=${draft.data.id}&autoImage=1`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate post. Try again.');
      setGenerating(false);
    }
  };

  return { generate, generating, error };
}
