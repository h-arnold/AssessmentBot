import { BookOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Button, Card, Layout, Space, Statistic, Typography } from 'antd';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

/**
 * Renders the main frontend scaffold view.
 *
 * @returns {JSX.Element} Frontend application shell.
 */
function App() {
  return (
    <Layout>
      <Header className="app-header">
        <Space>
          <BookOutlined />
          <span>AssessmentBot Frontend</span>
        </Space>
      </Header>
      <Content className="app-content">
        <Card>
          <Space orientation="vertical" size="large">
            <Title level={2}>React + Vite + Ant Design baseline</Title>
            <Paragraph>
              This frontend scaffold runs in strict TypeScript mode and is ready for the new
              AssessmentBot interface.
            </Paragraph>
            <Space size="large">
              <Statistic title="Frontend status" prefix={<CheckCircleOutlined />} value="Ready" />
              <Button type="primary">Start integration</Button>
            </Space>
          </Space>
        </Card>
      </Content>
    </Layout>
  );
}

export default App;
