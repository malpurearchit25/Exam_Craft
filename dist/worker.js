import {
  solve,
  compare
} from './engine.js';
self.onmessage = ({
  data: {
    id,
    type,
    data,
    options
  }
}) => {
  try {
    self.postMessage({
      id,
      result: type === 'compare' ? compare(data, options) : solve(data, options)
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error.message
    });
  }
};
