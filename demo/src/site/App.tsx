import { useEffect } from 'react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Tour } from './sections/Tour';
import { PhoneSection } from './sections/PhoneSection';
import { Offline } from './sections/Offline';
import { Features } from './sections/Features';
import { DownloadSection } from './sections/Download';
import { Footer } from './sections/Footer';

export default function App() {
  // Fade sections in as they scroll into view.
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Tour />
        <PhoneSection />
        <Offline />
        <Features />
        <DownloadSection />
      </main>
      <Footer />
    </>
  );
}
