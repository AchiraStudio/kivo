import { Joyride, Step, STATUS } from 'react-joyride';

interface TourGuideProps {
  steps: Step[];
  run: boolean;
  onFinish: () => void;
}

export default function TourGuide({ steps, run, onFinish }: TourGuideProps) {
  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onFinish();
    }
  };

  const joyrideProps: any = {
    steps,
    run,
    continuous: true,
    scrollToFirstStep: true,
    showSkipButton: true,
    callback: handleJoyrideCallback,
    styles: {
      options: {
        arrowColor: 'var(--color-elevated)',
        backgroundColor: 'var(--color-elevated)',
        overlayColor: 'rgba(0, 0, 0, 0.45)',
        primaryColor: 'var(--color-primary)',
        textColor: 'var(--color-heading)',
        zIndex: 1000,
      },
      buttonClose: { display: 'none' },
      buttonSkip: { color: 'var(--color-dim)', fontSize: '12px', fontWeight: 600 },
      buttonBack: { color: 'var(--color-body)', fontSize: '12px', fontWeight: 600, marginRight: '8px' },
      tooltip: {
        borderRadius: '12px',
        padding: '18px',
        fontFamily: 'inherit',
        boxShadow: '0 10px 24px -6px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--color-line)',
      },
      tooltipContainer: { textAlign: 'left' },
      tooltipTitle: {
        fontSize: '15px',
        fontWeight: 700,
        marginBottom: '6px',
        color: 'var(--color-heading)',
      },
      tooltipContent: {
        fontSize: '13px',
        color: 'var(--color-body)',
        lineHeight: 1.5,
      },
      buttonNext: {
        borderRadius: '8px',
        padding: '7px 14px',
        fontSize: '12px',
        fontWeight: 600,
      },
    },
    locale: {
      last: 'Selesai',
      skip: 'Lewati',
      next: 'Lanjut',
      back: 'Kembali',
    },
  };

  return <Joyride {...joyrideProps} />;
}
