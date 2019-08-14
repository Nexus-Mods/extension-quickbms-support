import * as React from 'react';
import { withTranslation } from 'react-i18next';
import { PureComponentEx, util } from 'vortex-api';

const DOWNLOAD_PAGE = 'https://aluigi.altervista.org/quickbms.htm';

import * as api from 'vortex-api';
const { Dashlet } = api as any;

class PakAttribDashlet extends PureComponentEx<{}, {}> {
  public render() {
    const { t } = this.props;
    return (
      <Dashlet
        title={t('Support for this game is made possible using QuickBMS')}
        className='dashlet-quickbms'
      >
        <div>
          {t('Special thanks to {{author}} for developing this tool',
          { replace: { author: 'Luigi Auriemma' }})}
        </div>
      </Dashlet>
    );
  }

  private openQBMSPage = () => {
    (util as any).opn(DOWNLOAD_PAGE);
  }
}

export default withTranslation(['common', 'pak-support'])
  (PakAttribDashlet as any) as React.ComponentClass<{}>;
