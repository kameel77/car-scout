import React from 'react';
import { useParams } from 'react-router-dom';
import { DynamicWidget } from '@/components/public/DynamicWidget';
import { Helmet } from 'react-helmet-async';

export default function WidgetEmbedPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <Helmet>
        <title>Oferta polecana</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      {/* 
        This page intentionally omits Header and Footer 
        so it can be embedded cleanly via iframe 
      */}
      <div className="bg-transparent min-h-screen p-4">
        <DynamicWidget placement="EXTERNAL" widgetId={id} />
      </div>
    </>
  );
}
