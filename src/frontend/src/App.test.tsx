import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the scaffold heading', () => {
    render(<App />);
    expect(screen.getByText('AssessmentBot Frontend')).toBeInTheDocument();
    expect(screen.getByText('React + Vite + Ant Design baseline')).toBeInTheDocument();
  });
});
