import { render, screen } from '@testing-library/react';
import { Mascot } from '../components/Mascot';
import { MASCOT_POSES, MASCOT_POSE_SRC } from '../mascot/assets';

describe('Mascot', () => {
  it('has a distinct hashed asset for every pose', () => {
    const sources = MASCOT_POSES.map((pose) => MASCOT_POSE_SRC[pose]);
    expect(new Set(sources).size).toBe(MASCOT_POSES.length);
    for (const pose of MASCOT_POSES) expect(MASCOT_POSE_SRC[pose]).toContain(`mascot-${pose}.webp`);
  });

  it('is decorative by default: hidden from assistive tech', () => {
    const { container } = render(<Mascot pose="wave" />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('is named when it carries meaning', () => {
    render(
      <Mascot pose="celebrate" label="Credi celebrates" size="xl" motion="float" loading="eager" />,
    );
    const image = screen.getByRole('img', { name: 'Credi celebrates' });
    expect(image).toHaveAttribute('src', MASCOT_POSE_SRC.celebrate);
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveClass('size-56', 'animate-mascot-float');
  });

  it('defaults to a still, medium, lazy image', () => {
    const { container } = render(<Mascot pose="think" />);
    const image = container.querySelector('img');
    expect(image).toHaveClass('size-24');
    expect(image?.className).not.toMatch(/animate-/);
    expect(image).toHaveAttribute('loading', 'lazy');
  });
});
