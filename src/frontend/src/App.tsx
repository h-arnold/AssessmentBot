import { BookOutlined } from '@ant-design/icons';
import { Layout, Space } from 'antd';
import { AuthStatusCard } from './features/auth/AuthStatusCard';

const { Header, Content } = Layout;

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
        <AuthStatusCard />
      </Content>
    </Layout>
  );
}

export default App;
